import { sendProcedureToIlis } from './apiClient.js';
import { saveSession, getSettings } from './db.js';

class ImportEngine {
  constructor() {
    this.reset();
    this.listeners = new Set();
  }

  reset() {
    this.sessionId = null;
    this.fileName = '';
    this.status = 'idle'; // 'idle' | 'running' | 'paused' | 'stopped' | 'completed'
    this.records = []; // All records to import
    this.results = []; // Processed outcomes
    this.currentIndex = 0;
    this.total = 0;
    this.successCount = 0;
    this.failedCount = 0;
    this.skippedCount = 0;
    this.startTime = null;
    this.endTime = null;
    this.currentProcedure = null;
    this.delayMs = 500;
    this.mockMode = false;
    this.logs = [];
    this.pausePromiseResolve = null;
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  emit(type, data) {
    const event = {
      type,
      timestamp: new Date().toISOString(),
      status: this.status,
      data
    };
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in import listener:', err);
      }
    }
  }

  addLog(entry) {
    const logItem = {
      id: Math.random().toString(36).substring(2, 9),
      time: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
      timestamp: new Date().toISOString(),
      ...entry
    };
    this.logs.unshift(logItem);
    if (this.logs.length > 500) {
      this.logs.pop();
    }
    this.emit('log', logItem);
    return logItem;
  }

  getStatus() {
    const elapsedMs = this.startTime
      ? (this.endTime ? new Date(this.endTime) - new Date(this.startTime) : Date.now() - new Date(this.startTime))
      : 0;

    const percent = this.total > 0 ? Math.round((this.currentIndex / this.total) * 100) : 0;

    return {
      sessionId: this.sessionId,
      fileName: this.fileName,
      status: this.status,
      total: this.total,
      processed: this.currentIndex,
      percent,
      success: this.successCount,
      failed: this.failedCount,
      skipped: this.skippedCount,
      currentProcedure: this.currentProcedure,
      startTime: this.startTime,
      endTime: this.endTime,
      elapsedMs,
      delayMs: this.delayMs,
      mockMode: this.mockMode,
      logs: this.logs.slice(0, 100),
      results: this.results
    };
  }

  async startImport({ records, fileName = 'Import_Batch', delayMs = 500, mockMode = false }) {
    if (this.status === 'running') {
      throw new Error('Tiến trình import đang chạy. Vui lòng dừng hoặc chờ hoàn thành.');
    }

    this.reset();
    this.sessionId = 'ses_' + Date.now();
    this.fileName = fileName;
    this.records = records || [];
    this.total = this.records.length;
    this.delayMs = Math.max(100, Number(delayMs) || 500);
    this.mockMode = Boolean(mockMode);
    this.status = 'running';
    this.startTime = new Date().toISOString();

    this.addLog({
      type: 'INFO',
      message: `Khởi động phiên import: ${this.fileName} (${this.total} thủ tục). Chế độ: ${this.mockMode ? 'MOCK SIMULATION' : 'LIVE API'}`
    });

    this.runLoop();
    return this.getStatus();
  }

  async runLoop() {
    const settings = getSettings();
    const gatewayUrl = settings.gatewayUrl;
    const endpointPath = settings.endpointPath;

    while (this.currentIndex < this.total && this.status !== 'stopped') {
      // Handle Pause
      if (this.status === 'paused') {
        this.addLog({
          type: 'WARNING',
          message: 'Tiến trình tạm dừng. Đang chờ người dùng tiếp tục...'
        });
        await new Promise(resolve => {
          this.pausePromiseResolve = resolve;
        });
        if (this.status === 'stopped') break;
      }

      const item = this.records[this.currentIndex];
      this.currentProcedure = {
        index: this.currentIndex + 1,
        maThuTuc: item.maThuTuc,
        tenThuTuc: item.tenThuTuc
      };

      this.emit('progress', this.getStatus());

      // If item was already checked as invalid during validation, skip or record failure
      if (item.isValid === false) {
        this.skippedCount++;
        const recordResult = {
          index: this.currentIndex + 1,
          maThuTuc: item.maThuTuc,
          tenThuTuc: item.tenThuTuc,
          status: 'BỎ QUA',
          httpStatus: 0,
          message: item.errors ? item.errors.join('; ') : 'Dữ liệu không hợp lệ',
          executedAt: new Date().toISOString()
        };
        this.results.push(recordResult);
        this.addLog({
          type: 'SKIP',
          maThuTuc: item.maThuTuc,
          message: `Bỏ qua [${item.maThuTuc}]: ${recordResult.message}`
        });
        this.currentIndex++;
        continue;
      }

      // Execute single POST
      const res = await sendProcedureToIlis(item.payload, {
        gatewayUrl,
        endpointPath,
        mockMode: this.mockMode
      });

      const recordResult = {
        index: this.currentIndex + 1,
        maThuTuc: item.maThuTuc,
        tenThuTuc: item.tenThuTuc,
        status: res.success ? 'THÀNH CÔNG' : 'THẤT BẠI',
        httpStatus: res.httpStatus,
        message: res.message,
        executedAt: new Date().toISOString()
      };
      this.results.push(recordResult);

      if (res.success) {
        this.successCount++;
        this.addLog({
          type: 'SUCCESS',
          maThuTuc: item.maThuTuc,
          httpStatus: res.httpStatus,
          message: `[${item.maThuTuc}] Thành công: ${res.message}`
        });
      } else {
        this.failedCount++;
        this.addLog({
          type: 'ERROR',
          maThuTuc: item.maThuTuc,
          httpStatus: res.httpStatus,
          message: `[${item.maThuTuc}] Thất bại (${res.httpStatus}): ${res.message}`
        });

        // Special handling for HTTP 401 Unauthorized
        if (res.httpStatus === 401 || res.type === 'AUTH_ERROR') {
          this.status = 'paused';
          this.addLog({
            type: 'ALERT',
            message: '⚠️ PHÁT HIỆN TOKEN HẾT HẠN HOẶC KHÔNG HỢP LỆ! Tiến trình đã TỰ ĐỘNG TẠM DỪNG. Vui lòng cập nhật Bearer Token mới và bấm "Tiếp tục".'
          });
          this.emit('auth_required', { message: res.message });
        }

        // Special handling for HTTP 429 Rate Limit
        if (res.httpStatus === 429) {
          this.addLog({
            type: 'WARNING',
            message: '⚠️ Bị giới hạn tốc độ (HTTP 429). Hệ thống đang chờ 5 giây trước khi xử lý tiếp...'
          });
          await new Promise(r => setTimeout(r, 5000));
        }
      }

      this.currentIndex++;

      // Delay between requests
      if (this.currentIndex < this.total && this.status === 'running') {
        await new Promise(res => setTimeout(res, this.delayMs));
      }
    }

    if (this.status !== 'stopped') {
      this.status = 'completed';
    }
    this.endTime = new Date().toISOString();
    this.currentProcedure = null;

    this.addLog({
      type: 'INFO',
      message: `Hoàn tất phiên import! Tổng: ${this.total}, Thành công: ${this.successCount}, Thất bại: ${this.failedCount}, Bỏ qua: ${this.skippedCount}.`
    });

    // Save session to persistent store
    saveSession({
      id: this.sessionId,
      fileName: this.fileName,
      startTime: this.startTime,
      endTime: this.endTime,
      total: this.total,
      success: this.successCount,
      failed: this.failedCount,
      skipped: this.skippedCount,
      status: this.status,
      records: this.results
    });

    this.emit('completed', this.getStatus());
  }

  pauseImport() {
    if (this.status === 'running') {
      this.status = 'paused';
      this.addLog({
        type: 'INFO',
        message: 'Đã nhận lệnh Tạm dừng import.'
      });
      this.emit('paused', this.getStatus());
      return true;
    }
    return false;
  }

  resumeImport() {
    if (this.status === 'paused') {
      this.status = 'running';
      this.addLog({
        type: 'INFO',
        message: 'Tiếp tục import từ bản ghi hiện tại.'
      });
      if (this.pausePromiseResolve) {
        this.pausePromiseResolve();
        this.pausePromiseResolve = null;
      }
      this.emit('resumed', this.getStatus());
      return true;
    }
    return false;
  }

  stopImport() {
    if (this.status === 'running' || this.status === 'paused') {
      this.status = 'stopped';
      this.endTime = new Date().toISOString();
      this.addLog({
        type: 'WARNING',
        message: 'Người dùng đã bấm Dừng tiến trình import.'
      });
      if (this.pausePromiseResolve) {
        this.pausePromiseResolve();
        this.pausePromiseResolve = null;
      }
      // Save partial session
      saveSession({
        id: this.sessionId,
        fileName: this.fileName,
        startTime: this.startTime,
        endTime: this.endTime,
        total: this.total,
        success: this.successCount,
        failed: this.failedCount,
        skipped: this.skippedCount,
        status: 'stopped',
        records: this.results
      });
      this.emit('stopped', this.getStatus());
      return true;
    }
    return false;
  }
}

export const importEngine = new ImportEngine();
