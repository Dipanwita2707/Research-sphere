/**
 * Excel Export Service
 * Generates comprehensive Excel reports from audit data
 */

const ExcelJS = require('exceljs');

class ExcelExportService {
  /**
   * Generate comprehensive audit report Excel file
   * @param {Object} data - Report data containing logs and period info
   * @returns {Buffer} - Excel file buffer
   */
  async generateAuditReport(data) {
    const { logs, period, statistics } = data;
    const workbook = new ExcelJS.Workbook();

    workbook.creator = 'ResearchSphere';
    workbook.created = new Date();
    workbook.modified = new Date();

    // Add Summary sheet
    await this.addSummarySheet(workbook, period, statistics);

    // Add Detailed Logs sheet
    await this.addDetailedLogsSheet(workbook, logs);

    // Add Statistics sheets
    await this.addStatisticsSheet(workbook, statistics);

    // Add Error Logs sheet (filtered)
    await this.addErrorLogsSheet(workbook, logs);

    // Add User Activity sheet
    await this.addUserActivitySheet(workbook, statistics);

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }

  /**
   * Add Summary sheet with overview statistics
   */
  async addSummarySheet(workbook, period, statistics) {
    const sheet = workbook.addWorksheet('Summary', {
      properties: { tabColor: { argb: '1E3A8A' } }
    });

    // Title
    sheet.mergeCells('A1:F1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `Audit Report - ${period.monthName} ${period.year}`;
    titleCell.font = { size: 20, bold: true, color: { argb: '1E3A8A' } };
    titleCell.alignment = { horizontal: 'center' };

    // Period info
    sheet.mergeCells('A2:F2');
    const periodCell = sheet.getCell('A2');
    periodCell.value = `Period: ${new Date(period.startDate).toLocaleDateString()} - ${new Date(period.endDate).toLocaleDateString()}`;
    periodCell.font = { size: 12, italic: true };
    periodCell.alignment = { horizontal: 'center' };

    // Report generation info
    sheet.mergeCells('A3:F3');
    const genCell = sheet.getCell('A3');
    genCell.value = `Generated: ${new Date().toLocaleString()}`;
    genCell.font = { size: 10, color: { argb: '666666' } };
    genCell.alignment = { horizontal: 'center' };

    // Key Metrics
    sheet.getCell('A5').value = 'KEY METRICS';
    sheet.getCell('A5').font = { size: 14, bold: true };

    const metrics = [
      ['Total Log Entries', statistics.totalLogs],
      ['Errors/Critical Issues', statistics.errorCount],
      ['Active Modules', statistics.byModule.length],
      ['Unique Users', statistics.topActors.length],
      ['Most Active Module', statistics.byModule[0]?.module || 'N/A'],
      ['Most Common Action', statistics.byActionType[0]?.actionType || 'N/A']
    ];

    let row = 6;
    metrics.forEach(([label, value]) => {
      sheet.getCell(`A${row}`).value = label;
      sheet.getCell(`A${row}`).font = { bold: true };
      sheet.getCell(`B${row}`).value = value;
      sheet.getCell(`B${row}`).alignment = { horizontal: 'right' };
      row++;
    });

    // Module breakdown
    row += 2;
    sheet.getCell(`A${row}`).value = 'ACTIVITY BY MODULE';
    sheet.getCell(`A${row}`).font = { size: 14, bold: true };
    row++;

    sheet.getCell(`A${row}`).value = 'Module';
    sheet.getCell(`B${row}`).value = 'Count';
    sheet.getCell(`C${row}`).value = 'Percentage';
    sheet.getRow(row).font = { bold: true };
    sheet.getRow(row).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
    row++;

    statistics.byModule.forEach(({ module, count }) => {
      sheet.getCell(`A${row}`).value = module || 'Unknown';
      sheet.getCell(`B${row}`).value = count;
      sheet.getCell(`C${row}`).value = `${((count / statistics.totalLogs) * 100).toFixed(1)}%`;
      row++;
    });

    // Severity breakdown
    row += 2;
    sheet.getCell(`A${row}`).value = 'SEVERITY DISTRIBUTION';
    sheet.getCell(`A${row}`).font = { size: 14, bold: true };
    row++;

    sheet.getCell(`A${row}`).value = 'Severity';
    sheet.getCell(`B${row}`).value = 'Count';
    sheet.getRow(row).font = { bold: true };
    sheet.getRow(row).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
    row++;

    statistics.bySeverity.forEach(({ severity, count }) => {
      const cell = sheet.getCell(`A${row}`);
      cell.value = severity;
      
      // Color code severity
      if (severity === 'ERROR' || severity === 'CRITICAL') {
        cell.font = { color: { argb: 'DC2626' }, bold: true };
      } else if (severity === 'WARNING') {
        cell.font = { color: { argb: 'D97706' } };
      }
      
      sheet.getCell(`B${row}`).value = count;
      row++;
    });

    // Set column widths
    sheet.getColumn('A').width = 25;
    sheet.getColumn('B').width = 15;
    sheet.getColumn('C').width = 15;
  }

  /**
   * Add Detailed Logs sheet with all audit entries
   */
  async addDetailedLogsSheet(workbook, logs) {
    const sheet = workbook.addWorksheet('Detailed Logs', {
      properties: { tabColor: { argb: '3B82F6' } }
    });

    // Headers
    const headers = [
      'Timestamp',
      'User',
      'User ID',
      'Action',
      'Action Type',
      'Module',
      'Category',
      'Severity',
      'Target Table',
      'Target ID',
      'Request Path',
      'Method',
      'Status',
      'Duration (ms)',
      'IP Address',
      'Error Message'
    ];

    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A8A' } };
    headerRow.height = 25;

    // Auto-filter
    sheet.autoFilter = {
      from: 'A1',
      to: `P${logs.length + 1}`
    };

    // Add data rows
    logs.forEach((log, index) => {
      const userName = log.actor?.employeeDetails?.displayName || 
                       log.actor?.uid || 
                       'System';
      
      const row = sheet.addRow([
        new Date(log.createdAt).toLocaleString(),
        userName,
        log.actor?.uid || 'N/A',
        log.action,
        log.actionType,
        log.module || 'N/A',
        log.category || 'N/A',
        log.severity,
        log.targetTable || 'N/A',
        log.targetId || 'N/A',
        log.requestPath || 'N/A',
        log.requestMethod || 'N/A',
        log.responseStatus || 'N/A',
        log.duration || 'N/A',
        log.ipAddress || 'N/A',
        log.errorMessage || ''
      ]);

      // Alternate row colors
      if (index % 2 === 1) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
      }

      // Color code severity
      const severityCell = row.getCell(8);
      if (log.severity === 'ERROR' || log.severity === 'CRITICAL') {
        severityCell.font = { color: { argb: 'DC2626' }, bold: true };
        severityCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } };
      } else if (log.severity === 'WARNING') {
        severityCell.font = { color: { argb: 'D97706' } };
        severityCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } };
      }

      // Color code HTTP status
      const statusCell = row.getCell(13);
      if (log.responseStatus >= 400) {
        statusCell.font = { color: { argb: 'DC2626' } };
      }
    });

    // Set column widths
    const columnWidths = [20, 25, 15, 50, 15, 12, 15, 10, 20, 36, 40, 8, 8, 12, 15, 40];
    columnWidths.forEach((width, i) => {
      sheet.getColumn(i + 1).width = width;
    });

    // Freeze header row
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
  }

  /**
   * Add Statistics sheet with action type and module breakdown
   */
  async addStatisticsSheet(workbook, statistics) {
    const sheet = workbook.addWorksheet('Statistics', {
      properties: { tabColor: { argb: '10B981' } }
    });

    // Action Type breakdown
    sheet.getCell('A1').value = 'Activity by Action Type';
    sheet.getCell('A1').font = { size: 14, bold: true };

    sheet.getCell('A2').value = 'Action Type';
    sheet.getCell('B2').value = 'Count';
    sheet.getRow(2).font = { bold: true };
    sheet.getRow(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };

    let row = 3;
    statistics.byActionType.forEach(({ actionType, count }) => {
      sheet.getCell(`A${row}`).value = actionType;
      sheet.getCell(`B${row}`).value = count;
      row++;
    });

    // Module breakdown (in column D)
    sheet.getCell('D1').value = 'Activity by Module';
    sheet.getCell('D1').font = { size: 14, bold: true };

    sheet.getCell('D2').value = 'Module';
    sheet.getCell('E2').value = 'Count';
    sheet.getCell('F2').value = 'Percentage';
    sheet.getRow(2).font = { bold: true };

    row = 3;
    statistics.byModule.forEach(({ module, count }) => {
      sheet.getCell(`D${row}`).value = module || 'Unknown';
      sheet.getCell(`E${row}`).value = count;
      sheet.getCell(`F${row}`).value = `${((count / statistics.totalLogs) * 100).toFixed(1)}%`;
      row++;
    });

    // Set column widths
    sheet.getColumn('A').width = 25;
    sheet.getColumn('B').width = 12;
    sheet.getColumn('C').width = 5;
    sheet.getColumn('D').width = 20;
    sheet.getColumn('E').width = 12;
    sheet.getColumn('F').width = 12;
  }

  /**
   * Add Error Logs sheet with filtered error entries
   */
  async addErrorLogsSheet(workbook, logs) {
    const errorLogs = logs.filter(log => 
      log.severity === 'ERROR' || 
      log.severity === 'CRITICAL' || 
      (log.responseStatus && log.responseStatus >= 400)
    );

    const sheet = workbook.addWorksheet('Errors & Warnings', {
      properties: { tabColor: { argb: 'DC2626' } }
    });

    if (errorLogs.length === 0) {
      sheet.getCell('A1').value = '🎉 No errors or warnings found in this period!';
      sheet.getCell('A1').font = { size: 14, color: { argb: '16A34A' } };
      return;
    }

    // Headers
    const headers = [
      'Timestamp',
      'User',
      'Severity',
      'Action',
      'Module',
      'Request Path',
      'HTTP Status',
      'Error Message',
      'IP Address'
    ];

    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DC2626' } };

    // Add error rows
    errorLogs.forEach(log => {
      const userName = log.actor?.employeeDetails?.displayName || 
                       log.actor?.uid || 
                       'System';

      const row = sheet.addRow([
        new Date(log.createdAt).toLocaleString(),
        userName,
        log.severity,
        log.action,
        log.module || 'N/A',
        log.requestPath || 'N/A',
        log.responseStatus || 'N/A',
        log.errorMessage || 'N/A',
        log.ipAddress || 'N/A'
      ]);

      // Highlight critical
      if (log.severity === 'CRITICAL') {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } };
      }
    });

    // Set column widths
    const columnWidths = [20, 25, 12, 40, 12, 40, 10, 50, 15];
    columnWidths.forEach((width, i) => {
      sheet.getColumn(i + 1).width = width;
    });

    // Freeze header row
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
  }

  /**
   * Add User Activity sheet
   */
  async addUserActivitySheet(workbook, statistics) {
    const sheet = workbook.addWorksheet('User Activity', {
      properties: { tabColor: { argb: '8B5CF6' } }
    });

    sheet.getCell('A1').value = 'Top Active Users';
    sheet.getCell('A1').font = { size: 14, bold: true };

    const headers = ['Rank', 'User Name', 'Email', 'Total Actions'];
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '8B5CF6' } };

    statistics.topActors.forEach((actor, index) => {
      sheet.addRow([
        index + 1,
        actor.actorName,
        actor.email || 'N/A',
        actor.count
      ]);
    });

    // Set column widths
    sheet.getColumn('A').width = 8;
    sheet.getColumn('B').width = 30;
    sheet.getColumn('C').width = 35;
    sheet.getColumn('D').width = 15;
  }

  /**
   * Generate a simple export of audit logs
   */
  async generateSimpleExport(logs) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Audit Logs');

    // Headers
    const headers = [
      'Timestamp',
      'User',
      'Action',
      'Action Type',
      'Module',
      'Severity',
      'Details'
    ];

    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A8A' } };
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };

    // Data
    logs.forEach(log => {
      const userName = log.actor?.employeeDetails?.displayName || 
                       log.actor?.uid || 
                       'System';

      sheet.addRow([
        new Date(log.createdAt).toLocaleString(),
        userName,
        log.action,
        log.actionType,
        log.module || 'N/A',
        log.severity,
        JSON.stringify(log.details || {})
      ]);
    });

    // Auto-fit columns
    sheet.columns.forEach(column => {
      column.width = 20;
    });

    return workbook.xlsx.writeBuffer();
  }
}

// Export singleton instance
const excelExportService = new ExcelExportService();

module.exports = { excelExportService };
