import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { Sidebar, TabId } from './components/Sidebar';
import { TokenModal } from './components/TokenModal';
import { ConfirmModal } from './components/ConfirmModal';
import { DashboardView } from './views/DashboardView';
import { ExcelImportView } from './views/ExcelImportView';
import { ProcedureUpdateView } from './views/ProcedureUpdateView';
import { ProcedureTimingView } from './views/ProcedureTimingView';
import { BpmnStepMappingView } from './views/BpmnStepMappingView';
import { ProcedureDeployView } from './views/ProcedureDeployView';
import { DvcProcedureMappingView } from './views/DvcProcedureMappingView';
import { MappingView } from './views/MappingView';
import { ExecutionView } from './views/ExecutionView';
import { HistoryView } from './views/HistoryView';
import { SettingsView } from './views/SettingsView';
import { api } from './services/api';
import { applyImportEvent } from './services/importEvents';
import {
  ExcelParsedData,
  MappingConfig,
  MappedRecord,
  MappingSummary,
  ProcedureLevelSource,
  TokenStatus,
  SystemSettings,
  ImportStatus,
  ImportSession,
  ProcessedRecord
} from './types';

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [excelData, setExcelData] = useState<ExcelParsedData | null>(null);
  const [domainMappings, setDomainMappings] = useState<Record<string, string>>({
    'Đất đai': '161A6A0F284D403C9EF8E1F612CCE8B5',
    'Đăng ký biện pháp bảo đảm': '161A6A0F284D403C9EF8E1F612CCE8B5'
  });
  const [mappingConfig, setMappingConfig] = useState<MappingConfig>({
    maThuTucCol: 'B',
    tenThuTucCol: 'D',
    tenVietTatCol: 'C',
    linhVucCol: 'E',
    moTaCol: '',
    defaults: {
      laThuTucCapXa: true,
      idLinhVuc: '161A6A0F284D403C9EF8E1F612CCE8B5',
      thoiHanTraThongBaoThue: '2',
      trangThai: 1,
      moTa: ''
    }
  });

  const [procedureLevels, setProcedureLevels] = useState<ProcedureLevelSource | null>(null);
  const [mappedRecords, setMappedRecords] = useState<MappedRecord[]>([]);
  const [mappingSummary, setMappingSummary] = useState<MappingSummary | null>(null);
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [sessions, setSessions] = useState<ImportSession[]>([]);

  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Confirm Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'single' | 'bulk';
    title: string;
    targetInfo: any;
    onConfirm: () => void;
  }>({
    isOpen: false,
    type: 'single',
    title: '',
    targetInfo: {},
    onConfirm: () => {}
  });

  // Re-run mapping preview whenever excelData, mappingConfig, or domainMappings change
  const refreshMapping = useCallback(async (
    data: ExcelParsedData | null,
    cfg: MappingConfig,
    domains: Record<string, string>
  ) => {
    if (!data || !data.rows || data.rows.length === 0) {
      setMappedRecords([]);
      setMappingSummary(null);
      return;
    }
    try {
      const res = await api.previewMapping(data.rows, cfg, domains);
      setMappedRecords(res.records);
      setMappingSummary(res.summary);
    } catch (err) {
      console.error('Error refreshing mapping preview:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    async function init() {
      try {
        const settingsRes = await api.getSettings();
        setSettings(settingsRes.settings);
        setDomainMappings(settingsRes.domainMappings || {});
        setProcedureLevels(settingsRes.procedureLevels);
        setTokenStatus(settingsRes.tokenStatus);

        const hist = await api.getHistory();
        setSessions(hist);

        const statusRes = await api.getImportStatus();
        setImportStatus(statusRes);

        // Preload sample file 30_10_danhsachthutuc.xls for immediate usability
        try {
          const sampleData = await api.parseLocalExcel('30_10_danhsachthutuc.xls');
          setExcelData(sampleData);
          await refreshMapping(sampleData, mappingConfig, settingsRes.domainMappings || {});
        } catch {
          // ignore if local file load fails
        }
      } catch (err) {
        console.error('Initial load failed:', err);
      }
    }
    init();
  }, []);

  // Server-Sent Events (SSE) listener for realtime import progress & logs
  useEffect(() => {
    const eventSource = new EventSource('/api/import/stream');

    eventSource.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        setImportStatus(prev => applyImportEvent(prev, payload));

        // If completed or stopped, refresh history
        if (payload.type === 'completed' || payload.type === 'stopped') {
          api.getHistory().then(setSessions);
        }

        // If auth error occurred, open token modal
        if (payload.type === 'auth_required') {
          setIsTokenModalOpen(true);
          api.getImportStatus().then(setImportStatus);
        }
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // File Upload handler
  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    try {
      const data = await api.uploadExcel(file);
      setExcelData(data);
      await refreshMapping(data, mappingConfig, domainMappings);
    } catch (err: any) {
      alert(`Lỗi đọc file Excel: ${err?.response?.data?.error || err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Sample file load
  const handleLoadSample = async (fileName: string) => {
    setIsLoading(true);
    try {
      const data = await api.parseLocalExcel(fileName);
      setExcelData(data);
      await refreshMapping(data, mappingConfig, domainMappings);
    } catch (err: any) {
      alert(`Lỗi đọc file mẫu: ${err?.response?.data?.error || err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Reparse with sheet or header row
  const handleReparse = async (sheetName?: string, headerRowIndex?: number) => {
    if (!excelData) return;
    setIsLoading(true);
    try {
      const data = await api.parseLocalExcel(excelData.fileName, sheetName, headerRowIndex);
      setExcelData(data);
      await refreshMapping(data, mappingConfig, domainMappings);
    } catch (err: any) {
      alert(`Lỗi phân tích lại: ${err?.response?.data?.error || err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // "Tổng hợp quy trình thủ tục" upload: decides laThuTucCapXa per procedure
  const handleUploadProcedureLevels = async (file: File) => {
    setIsLoading(true);
    try {
      const source = await api.uploadProcedureLevels(file);
      setProcedureLevels(source);
      setDryRunResult(null);
      await refreshMapping(excelData, mappingConfig, domainMappings);
    } catch (err: any) {
      alert(err?.response?.data?.error || `Lỗi đọc file: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearProcedureLevels = async () => {
    setIsLoading(true);
    try {
      await api.clearProcedureLevels();
      setProcedureLevels(null);
      setDryRunResult(null);
      await refreshMapping(excelData, mappingConfig, domainMappings);
    } catch (err: any) {
      alert(`Lỗi gỡ file: ${err?.response?.data?.error || err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Update mapping config
  const handleUpdateMappingConfig = (newCfg: MappingConfig) => {
    setMappingConfig(newCfg);
    refreshMapping(excelData, newCfg, domainMappings);
  };

  // Update domain mappings
  const handleUpdateDomainMappings = (newDomains: Record<string, string>) => {
    setDomainMappings(newDomains);
    api.saveSettings({ domainMappings: newDomains });
    refreshMapping(excelData, mappingConfig, newDomains);
  };

  // Token management
  const handleSaveToken = async (token: string) => {
    const res = await api.setToken(token);
    setTokenStatus(res.status);
  };

  const handleClearToken = async () => {
    const res = await api.clearToken();
    setTokenStatus(res.status);
  };

  // Toggle mock mode
  const handleToggleMockMode = async () => {
    if (!settings) return;
    const newMock = !settings.mockMode;
    const res = await api.saveSettings({ settings: { mockMode: newMock } });
    setSettings(res.settings);
  };

  // Save general settings
  const handleSaveSettings = async (newSettings: Partial<SystemSettings>) => {
    const res = await api.saveSettings({ settings: newSettings });
    setSettings(res.settings);
  };

  // Dry Run
  const handleRunDryRun = async () => {
    if (!excelData) return;
    setIsLoading(true);
    try {
      const res = await api.dryRun(excelData.rows, mappingConfig, domainMappings);
      setDryRunResult(res);
    } catch (err: any) {
      alert(`Lỗi chạy Dry Run: ${err?.response?.data?.error || err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Test Single Request (Confirmation modal)
  const handleRequestTestSingle = (record: MappedRecord) => {
    setConfirmModal({
      isOpen: true,
      type: 'single',
      title: 'Xác nhận Thử nghiệm Gửi 1 Bản ghi',
      targetInfo: {
        procedureCode: record.maThuTuc,
        procedureName: record.tenThuTuc,
        gatewayUrl: settings?.gatewayUrl,
        isMock: settings?.mockMode
      },
      onConfirm: async () => {
        try {
          const res = await api.testSingle(record.payload, true, settings?.mockMode);
          alert(
            res.success
              ? `✅ Thành công: ${res.message} (HTTP ${res.httpStatus})`
              : `❌ Thất bại: ${res.message} (HTTP ${res.httpStatus})`
          );
        } catch (err: any) {
          alert(`Lỗi gửi: ${err?.response?.data?.error || err.message}`);
        }
      }
    });
  };

  // Bulk Import Request (Confirmation modal)
  const handleRequestBulkImport = (delayMs: number) => {
    setConfirmModal({
      isOpen: true,
      type: 'bulk',
      title: 'Xác nhận Bắt đầu Import Hàng loạt',
      targetInfo: {
        totalRecords: mappedRecords.length,
        gatewayUrl: settings?.gatewayUrl,
        isMock: settings?.mockMode,
        delayMs
      },
      onConfirm: async () => {
        try {
          await api.startImport(
            mappedRecords,
            excelData?.fileName || 'Import_Batch',
            delayMs,
            Boolean(settings?.mockMode),
            true
          );
          setActiveTab('execution');
        } catch (err: any) {
          alert(`Lỗi khởi chạy import: ${err?.response?.data?.error || err.message}`);
        }
      }
    });
  };

  // Pause / Resume / Stop
  const handlePauseImport = async () => {
    await api.pauseImport();
  };

  const handleResumeImport = async () => {
    await api.resumeImport();
  };

  const handleStopImport = async () => {
    await api.stopImport();
  };

  // Export Excel
  const handleExportExcel = async (records: ProcessedRecord[], onlyFailed: boolean) => {
    try {
      await api.exportExcel(records, onlyFailed);
    } catch (err: any) {
      alert(`Lỗi xuất file Excel: ${err?.message}`);
    }
  };

  // Select historical session
  const handleSelectSession = async (session: ImportSession) => {
    try {
      const full = await api.getSessionDetails(session.id);
      if (full && full.records) {
        handleExportExcel(full.records, false);
      }
    } catch (err: any) {
      alert(`Lỗi tải phiên: ${err?.message}`);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        hasFile={Boolean(excelData)}
        totalRecords={excelData?.totalRows || 0}
        mappingValidCount={mappingSummary?.valid || 0}
        isImportRunning={importStatus?.status === 'running'}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <Header
          tokenStatus={tokenStatus}
          settings={settings}
          loadedFileName={excelData?.fileName}
          totalRecords={excelData?.totalRows}
          onOpenTokenModal={() => setIsTokenModalOpen(true)}
          onToggleMockMode={handleToggleMockMode}
        />

        {/* Scrollable View Container */}
        <main className="flex-1 overflow-y-auto bg-slate-950">
          {activeTab === 'dashboard' && (
            <DashboardView
              excelData={excelData}
              mappingSummary={mappingSummary}
              tokenStatus={tokenStatus}
              settings={settings}
              sessions={sessions}
              onNavigate={setActiveTab}
              onOpenTokenModal={() => setIsTokenModalOpen(true)}
              onLoadSample={handleLoadSample}
            />
          )}

          {activeTab === 'excel' && (
            <ExcelImportView
              excelData={excelData}
              onFileUpload={handleFileUpload}
              onSelectSample={handleLoadSample}
              onReparse={handleReparse}
              procedureLevels={procedureLevels}
              levelReport={mappingSummary?.levelReport ?? null}
              onUploadProcedureLevels={handleUploadProcedureLevels}
              onClearProcedureLevels={handleClearProcedureLevels}
              isLoading={isLoading}
              onNavigateToMapping={() => setActiveTab('mapping')}
            />
          )}

          {activeTab === 'procedure' && (
            <ProcedureUpdateView
              tokenStatus={tokenStatus}
              onOpenTokenModal={() => setIsTokenModalOpen(true)}
            />
          )}

          {activeTab === 'procedureTiming' && (
            <ProcedureTimingView
              tokenStatus={tokenStatus}
              onOpenTokenModal={() => setIsTokenModalOpen(true)}
            />
          )}

          {activeTab === 'bpmnStepMapping' && (
            <BpmnStepMappingView
              tokenStatus={tokenStatus}
              onOpenTokenModal={() => setIsTokenModalOpen(true)}
            />
          )}

          {activeTab === 'procedureDeploy' && (
            <ProcedureDeployView
              tokenStatus={tokenStatus}
              onOpenTokenModal={() => setIsTokenModalOpen(true)}
            />
          )}

          {activeTab === 'dvcProcedureMapping' && (
            <DvcProcedureMappingView
              tokenStatus={tokenStatus}
              onOpenTokenModal={() => setIsTokenModalOpen(true)}
            />
          )}

          {activeTab === 'mapping' && (
            <MappingView
              excelData={excelData}
              mappingConfig={mappingConfig}
              onUpdateMappingConfig={handleUpdateMappingConfig}
              domainMappings={domainMappings}
              onUpdateDomainMappings={handleUpdateDomainMappings}
              mappedRecords={mappedRecords}
              mappingSummary={mappingSummary}
              hasProcedureLevels={Boolean(procedureLevels)}
              onNavigateToExecution={() => setActiveTab('execution')}
            />
          )}

          {activeTab === 'execution' && (
            <ExecutionView
              mappedRecords={mappedRecords}
              fileName={excelData?.fileName || 'ILIS_Batch'}
              tokenStatus={tokenStatus}
              settings={settings}
              importStatus={importStatus}
              onRunDryRun={handleRunDryRun}
              onRequestTestSingle={handleRequestTestSingle}
              onRequestBulkImport={handleRequestBulkImport}
              onPauseImport={handlePauseImport}
              onResumeImport={handleResumeImport}
              onStopImport={handleStopImport}
              onOpenTokenModal={() => setIsTokenModalOpen(true)}
              dryRunResult={dryRunResult}
              isProcessing={isLoading}
            />
          )}

          {activeTab === 'history' && (
            <HistoryView
              sessions={sessions}
              currentResults={importStatus?.results || []}
              onExportExcel={handleExportExcel}
              onSelectSession={handleSelectSession}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              tokenStatus={tokenStatus}
              onSaveSettings={handleSaveSettings}
              onOpenTokenModal={() => setIsTokenModalOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Bearer Token Modal */}
      <TokenModal
        isOpen={isTokenModalOpen}
        onClose={() => setIsTokenModalOpen(false)}
        tokenStatus={tokenStatus}
        onSaveToken={handleSaveToken}
        onClearToken={handleClearToken}
      />

      {/* Action Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        type={confirmModal.type}
        targetInfo={confirmModal.targetInfo}
      />
    </div>
  );
}

export default App;
