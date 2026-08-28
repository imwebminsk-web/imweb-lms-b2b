import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export async function exportGradebookToExcel(
  cohortName: string,
  columns: any[],
  rows: any[]
) {
  const wb = new ExcelJS.Workbook();
  const wsMain = wb.addWorksheet('Итоговые');
  const wsTraining = wb.addWorksheet('Тренировки');

  const mainCols = columns.filter(c => c.type === 'assignment' || c.testType === 'final');
  const trainingCols = columns.filter(c => c.testType === 'training');

  const getHeaders = (cols: any[]) => ['ФИО ученика', 'Email', ...cols.map(c => c.title)];
  
  const getCellValue = (item: any) => {
    if (!item) return 'Не приступал';
    if (item.status === 'pending_review') return 'На проверке';
    if (item.status === 'in_progress') return 'В процессе';
    if (item.status === 'rejected' || item.status === 'needs_revision') return 'На пересдаче';
    if (item.status === 'completed' || item.status === 'approved') {
      const pts = item.points ?? item.score;
      return typeof pts === 'number' ? `${pts}%` : (pts || 'Сдано');
    }
    return 'Не приступал';
  };

  const styleRow = (row: ExcelJS.Row) => {
    row.eachCell((cell, colNumber) => {
      // Выравнивание
      if (colNumber <= 2) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        
        // Цвета статусов
        if (cell.value === 'На проверке' || cell.value === 'На пересдаче') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } }; // Желтый
          cell.font = { color: { argb: 'FF856404' } };
        } else if (cell.value === 'Не приступал') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8D7DA' } }; // Красный
          cell.font = { color: { argb: 'FF721C24' } };
        } else if (cell.value === 'В процессе') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1ECF1' } }; // Синий
          cell.font = { color: { argb: 'FF0C5460' } };
        }
      }
      
      // Рамки
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
      };
    });
  };

  // --- Заполнение Итоговых ---
  wsMain.addRow(getHeaders(mainCols));
  rows.forEach(r => {
    const rowData = [r.studentName, r.studentEmail];
    mainCols.forEach(col => {
      const cell = r.items.find((i: any) => i.columnId === col.id);
      rowData.push(getCellValue(cell));
    });
    const excelRow = wsMain.addRow(rowData);
    styleRow(excelRow);
  });

  // --- Заполнение Тренировок ---
  if (trainingCols.length > 0) {
    wsTraining.addRow(getHeaders(trainingCols));
    rows.forEach(r => {
      const rowData = [r.studentName, r.studentEmail];
      trainingCols.forEach(col => {
        const cell = r.items.find((i: any) => i.columnId === col.id);
        rowData.push(getCellValue(cell));
      });
      const excelRow = wsTraining.addRow(rowData);
      styleRow(excelRow);
    });
  }

  // --- Стилизация заголовков и колонок ---
  [wsMain, wsTraining].forEach(ws => {
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } }; // Темно-синий
    header.alignment = { horizontal: 'center', vertical: 'middle' };
    
    ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }]; // Фиксируем шапку и имена
    
    ws.columns.forEach((column) => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const text = cell.value ? cell.value.toString() : '';
        if (text.length > maxLength) {
          maxLength = text.length;
        }
      });
      // Устанавливаем ширину: минимум 12, максимум 50, +2 символа для отступа
      column.width = Math.min(Math.max(maxLength + 2, 12), 50);
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `Журнал_${cohortName || 'Группы'}.xlsx`);
}
