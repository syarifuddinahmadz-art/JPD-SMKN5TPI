import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TEACHING_STATUS_LABELS, type TeachingJournal } from '../types/journal';

export interface PrimarySummaryRow {
  title: string;
  meetings: number;
  totalJp: number;
  terlaksana: number;
  otherStatus: number;
  docsCount: number;
  attendancePct: number;
}

export interface ClassSummaryRow {
  className: string;
  subjectsCount: number;
  meetings: number;
  totalJp: number;
  docsCount: number;
  attendancePct: number;
}

export interface GenerateReportPdfParams {
  isSchoolWideRole: boolean;
  periodDescription: string;
  printedDate: string;
  preparerName: string;
  preparerNip: string;
  preparerRoleLabel: string;
  summary: {
    totalMeetings: number;
    totalJp: number;
    attendancePct: number;
    docsCount: number;
  };
  primaryRows: PrimarySummaryRow[];
  classRows: ClassSummaryRow[];
  journals: TeachingJournal[];
}

function getLastTableFinalY(doc: jsPDF, fallbackY: number): number {
  const internal = doc as unknown as { lastAutoTable?: { finalY?: number } };
  return internal.lastAutoTable?.finalY ?? fallbackY;
}

export function generateAcademicReportPdf(params: GenerateReportPdfParams): {
  fileName: string;
  blob: Blob;
} {
  const {
    isSchoolWideRole,
    periodDescription,
    printedDate,
    preparerName,
    preparerNip,
    preparerRoleLabel,
    summary,
    primaryRows,
    classRows,
    journals,
  } = params;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;

  // --- Official Letterhead ---
  doc.setTextColor(16, 45, 70); // #102D46 Navy
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('PEMERINTAH PROVINSI KEPULAUAN RIAU · DINAS PENDIDIKAN', pageWidth / 2, 15, {
    align: 'center',
  });

  doc.setFontSize(14);
  doc.text('SMK NEGERI 5 TANJUNGPINANG', pageWidth / 2, 21, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Laporan Rekapitulasi Jurnal Pembelajaran Digital (JPD-SMK)', pageWidth / 2, 26.5, {
    align: 'center',
  });

  // Double Accent Line (#102D46 & #16A6A0)
  doc.setDrawColor(16, 45, 70);
  doc.setLineWidth(0.8);
  doc.line(marginX, 30, pageWidth - marginX, 30);
  doc.setDrawColor(22, 166, 160);
  doc.setLineWidth(0.35);
  doc.line(marginX, 31.3, pageWidth - marginX, 31.3);

  // --- Metadata Summary ---
  doc.setTextColor(16, 45, 70);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Periode Laporan', marginX, 38);
  doc.text('Tanggal Cetak', marginX + 95, 38);

  doc.setFont('helvetica', 'normal');
  doc.text(`: ${periodDescription}`, marginX + 32, 38);
  doc.text(`: ${printedDate}`, marginX + 123, 38);

  doc.setFont('helvetica', 'bold');
  doc.text('Cakupan Data', marginX, 43);
  doc.text('Disusun Oleh', marginX + 95, 43);

  doc.setFont('helvetica', 'normal');
  doc.text(
    `: ${isSchoolWideRole ? 'Seluruh Guru & Kelas' : 'Jurnal Mengajar Pribadi'}`,
    marginX + 32,
    43,
  );
  doc.text(`: ${preparerName}`, marginX + 123, 43);

  // --- KPI Box Strip ---
  const boxY = 48;
  const boxH = 14;
  const colW = contentWidth / 4;
  const kpis = [
    { label: 'Total Pertemuan', value: String(summary.totalMeetings) },
    { label: 'Total Jam Pelajaran', value: `${summary.totalJp} JP` },
    { label: 'Rata-Rata Kehadiran', value: `${summary.attendancePct}%` },
    { label: 'Dengan Dokumentasi', value: String(summary.docsCount) },
  ];

  kpis.forEach((kpi, idx) => {
    const x = marginX + idx * colW;
    doc.setFillColor(245, 247, 250);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.rect(x, boxY, colW - (idx < 3 ? 2 : 0), boxH, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, x + 3, boxY + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(16, 45, 70);
    doc.text(kpi.value, x + 3, boxY + 11);
  });

  let cursorY = boxY + boxH + 7;

  // --- Table 1: Rekap per Guru / Mata Pelajaran ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(16, 45, 70);
  doc.text(
    isSchoolWideRole
      ? '1. Rekapitulasi Aktivitas per Guru'
      : '1. Rekapitulasi per Mata Pelajaran',
    marginX,
    cursorY,
  );

  autoTable(doc, {
    startY: cursorY + 2.5,
    margin: { left: marginX, right: marginX },
    head: [
      [
        'No',
        isSchoolWideRole ? 'Nama Guru' : 'Mata Pelajaran',
        'Pertemuan',
        'Total JP',
        'Terlaksana',
        'Lainnya',
        'Dokumentasi',
        'Kehadiran',
      ],
    ],
    body: primaryRows.map((row, idx) => [
      idx + 1,
      row.title,
      row.meetings,
      row.totalJp,
      row.terlaksana,
      row.otherStatus,
      row.docsCount,
      `${row.attendancePct}%`,
    ]),
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [16, 45, 70],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      2: { halign: 'right', cellWidth: 19 },
      3: { halign: 'right', cellWidth: 16 },
      4: { halign: 'right', cellWidth: 19 },
      5: { halign: 'right', cellWidth: 16 },
      6: { halign: 'right', cellWidth: 22 },
      7: { halign: 'right', cellWidth: 19 },
    },
  });

  cursorY = getLastTableFinalY(doc, cursorY + 20) + 7;

  // --- Table 2: Rekap per Kelas ---
  if (cursorY > pageHeight - 40) {
    doc.addPage();
    cursorY = 18;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(16, 45, 70);
  doc.text('2. Rekapitulasi per Kelas', marginX, cursorY);

  autoTable(doc, {
    startY: cursorY + 2.5,
    margin: { left: marginX, right: marginX },
    head: [
      ['No', 'Kelas', 'Jml Mapel', 'Total Pertemuan', 'Total JP', 'Dokumentasi', 'Kehadiran'],
    ],
    body: classRows.map((row, idx) => [
      idx + 1,
      row.className,
      row.subjectsCount,
      row.meetings,
      row.totalJp,
      row.docsCount,
      `${row.attendancePct}%`,
    ]),
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [28, 103, 138], // #1C678A Ocean Blue
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      2: { halign: 'right', cellWidth: 20 },
      3: { halign: 'right', cellWidth: 26 },
      4: { halign: 'right', cellWidth: 18 },
      5: { halign: 'right', cellWidth: 24 },
      6: { halign: 'right', cellWidth: 22 },
    },
  });

  cursorY = getLastTableFinalY(doc, cursorY + 20) + 7;

  // --- Table 3: Rincian Jurnal Pembelajaran ---
  if (cursorY > pageHeight - 45) {
    doc.addPage();
    cursorY = 18;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(16, 45, 70);
  doc.text('3. Rincian Jurnal Pembelajaran Harian', marginX, cursorY);

  const detailHead = isSchoolWideRole
    ? [['Tanggal', 'Jam', 'Guru', 'Kelas', 'Mapel & Materi Pokok', 'Status', 'H/A']]
    : [['Tanggal', 'Jam', 'Kelas', 'Mapel & Materi Pokok', 'Status', 'H/A']];

  const detailBody = journals.map((item) => {
    const baseTopic = `${item.subjectName}\n${item.topic}`;
    const attendance = `${item.presentCount}/${item.absentCount}`;
    const statusLabel = TEACHING_STATUS_LABELS[item.teachingStatus];
    return isSchoolWideRole
      ? [
          item.date,
          `${item.periodStart}-${item.periodEnd}`,
          item.teacherName,
          item.className,
          baseTopic,
          statusLabel,
          attendance,
        ]
      : [
          item.date,
          `${item.periodStart}-${item.periodEnd}`,
          item.className,
          baseTopic,
          statusLabel,
          attendance,
        ];
  });

  autoTable(doc, {
    startY: cursorY + 2.5,
    margin: { left: marginX, right: marginX },
    head: detailHead,
    body: detailBody,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [16, 45, 70],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    columnStyles: isSchoolWideRole
      ? {
          0: { cellWidth: 20 },
          1: { cellWidth: 11, halign: 'center' },
          2: { cellWidth: 28 },
          3: { cellWidth: 20 },
          5: { cellWidth: 22 },
          6: { cellWidth: 13, halign: 'right' },
        }
      : {
          0: { cellWidth: 22 },
          1: { cellWidth: 12, halign: 'center' },
          2: { cellWidth: 24 },
          4: { cellWidth: 25 },
          5: { cellWidth: 15, halign: 'right' },
        },
  });

  // --- Official Signature Block ---
  let sigY = getLastTableFinalY(doc, cursorY + 25) + 12;
  if (sigY > pageHeight - 42) {
    doc.addPage();
    sigY = 24;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);

  // Left signature (Principal)
  doc.text('Mengetahui,', marginX, sigY);
  doc.setFont('helvetica', 'bold');
  doc.text('Kepala SMK Negeri 5 Tanjungpinang', marginX, sigY + 4.5);
  doc.setFont('helvetica', 'normal');
  doc.line(marginX, sigY + 24, marginX + 58, sigY + 24);
  doc.text('NIP. ____________________________', marginX, sigY + 28.5);

  // Right signature (Preparer)
  const rightX = pageWidth - marginX - 62;
  doc.text(`Tanjungpinang, ${printedDate}`, rightX, sigY);
  doc.setFont('helvetica', 'bold');
  doc.text(preparerRoleLabel, rightX, sigY + 4.5);
  doc.text(preparerName, rightX, sigY + 23);
  doc.line(rightX, sigY + 24, rightX + 60, sigY + 24);
  doc.setFont('helvetica', 'normal');
  doc.text(`NIP. ${preparerNip || '____________________________'}`, rightX, sigY + 28.5);

  // --- Page Footer ---
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i += 1) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('JPD-SMK · SMK Negeri 5 Tanjungpinang', marginX, pageHeight - 8);
    doc.text(`Halaman ${i} dari ${totalPages}`, pageWidth - marginX, pageHeight - 8, {
      align: 'right',
    });
  }

  const safePeriod = periodDescription.replace(/[^a-zA-Z0-9_-]+/g, '_');
  const fileName = `Laporan_JPD_SMKN5_${safePeriod}.pdf`;
  const blob = doc.output('blob');
  return { fileName, blob };
}
