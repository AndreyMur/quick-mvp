import path from "node:path";
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { CalculationResult } from "@/lib/types/project";
import type { Style } from "@react-pdf/types";

const h = React.createElement;

const FONT_DIR = path.join(process.cwd(), "public", "fonts");

Font.register({
  family: "Roboto",
  fonts: [
    { src: path.join(FONT_DIR, "Roboto-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "Roboto-Bold.ttf"), fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    paddingBottom: 64,
    fontFamily: "Roboto",
    fontSize: 10,
    color: "#1a1a1a",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "#1a1a1a",
    paddingBottom: 12,
    marginBottom: 24,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoMark: {
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    fontSize: 11,
    fontWeight: 700,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 8,
  },
  brandName: {
    fontSize: 16,
    fontWeight: 700,
  },
  date: {
    fontSize: 9,
    color: "#666666",
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 6,
  },
  description: {
    fontSize: 10,
    color: "#666666",
    marginBottom: 20,
  },
  summary: {
    flexDirection: "row",
    marginBottom: 24,
  },
  summaryItem: {
    flexGrow: 1,
    flexBasis: 0,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 12,
    marginRight: 12,
  },
  summaryItemLast: {
    marginRight: 0,
  },
  summaryLabel: {
    fontSize: 9,
    color: "#666666",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 700,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 8,
  },
  table: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 4,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#1a1a1a",
  },
  tableRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  tableRowAlt: {
    backgroundColor: "#fafafa",
  },
  headerCell: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: 700,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  headerCellRight: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: 700,
    paddingHorizontal: 8,
    paddingVertical: 6,
    textAlign: "right",
  },
  cell: {
    fontSize: 9,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  cellRight: {
    fontSize: 9,
    paddingHorizontal: 8,
    paddingVertical: 6,
    textAlign: "right",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    paddingTop: 8,
    fontSize: 8,
    color: "#888888",
  },
  watermark: {
    position: "absolute",
    bottom: 24,
    right: 24,
    fontSize: 12,
    color: "#cccccc",
    transform: "rotate(-30deg)",
  },
});

export interface ReportProject {
  name: string;
  description?: string | null;
}

export interface ReportSnapshot {
  project: ReportProject;
  result: CalculationResult;
  isFree: boolean;
}

interface TableColumn {
  label: string;
  flex: number;
  align?: "left" | "right";
}

type PdfTextStyle = Style[];

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(
    Math.round(value)
  );
}

function formatHours(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCoefficient(value: number): string {
  return value.toFixed(2);
}

function formatMoney(value: number): string {
  return `${formatNumber(value)} у.е.`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function summaryItem(
  label: string,
  value: string,
  isLast = false
): React.ReactElement {
  return h(
    View,
    { style: isLast ? [styles.summaryItem, styles.summaryItemLast] : styles.summaryItem },
    h(Text, { style: styles.summaryLabel }, label),
    h(Text, { style: styles.summaryValue }, value)
  );
}

function cellStyle(column: TableColumn): PdfTextStyle {
  return [
    column.align === "right" ? styles.cellRight : styles.cell,
    { flexGrow: column.flex, flexBasis: 0 },
  ];
}

function headerCellStyle(column: TableColumn): PdfTextStyle {
  return [
    column.align === "right" ? styles.headerCellRight : styles.headerCell,
    { flexGrow: column.flex, flexBasis: 0 },
  ];
}

function tableHeader(columns: TableColumn[]): React.ReactElement {
  return h(
    View,
    { style: styles.tableHeaderRow, wrap: false },
    ...columns.map((column, index) =>
      h(
        Text,
        {
          key: `h-${index}`,
          style: headerCellStyle(column),
        },
        column.label
      )
    )
  );
}

function tableRow(
  columns: TableColumn[],
  values: string[],
  index: number
): React.ReactElement {
  return h(
    View,
    {
      key: `r-${index}`,
      style: index % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow,
      wrap: false,
    },
    ...columns.map((column, columnIndex) =>
      h(
        Text,
        {
          key: `c-${index}-${columnIndex}`,
          style: cellStyle(column),
        },
        values[columnIndex] ?? ""
      )
    )
  );
}

function table(
  columns: TableColumn[],
  rows: string[][]
): React.ReactElement {
  return h(
    View,
    { style: styles.table },
    tableHeader(columns),
    ...rows.map((values, index) => tableRow(columns, values, index))
  );
}

function section(
  title: string,
  content: React.ReactNode
): React.ReactElement {
  return h(
    View,
    { style: styles.section },
    h(Text, { style: styles.sectionTitle }, title),
    content
  );
}

const SERVICE_COLUMNS: TableColumn[] = [
  { label: "Название", flex: 4 },
  { label: "Часы", flex: 1.5, align: "right" },
  { label: "Стоимость", flex: 2, align: "right" },
];

const ROLE_COLUMNS: TableColumn[] = [
  { label: "Роль", flex: 4 },
  { label: "Ставка", flex: 2, align: "right" },
  { label: "Часы", flex: 1.5, align: "right" },
  { label: "Коэф.", flex: 1.5, align: "right" },
  { label: "Стоимость", flex: 2.5, align: "right" },
];

function serviceRows(result: CalculationResult): string[][] {
  return result.services.map((service) => [
    service.label,
    formatHours(service.hours),
    service.cost === null ? "—" : formatMoney(service.cost),
  ]);
}

function roleRows(result: CalculationResult): string[][] {
  return result.roles.map((role) => [
    role.label,
    formatMoney(role.hourly_rate),
    formatHours(role.adjusted_hours),
    formatCoefficient(role.coefficient),
    formatMoney(role.cost),
  ]);
}

function customServiceRows(result: CalculationResult): string[][] {
  return result.services
    .filter((service) => service.is_custom && service.cost !== null)
    .map((service) => [
      service.label,
      formatHours(service.hours),
      formatMoney(service.cost as number),
    ]);
}

/**
 * Builds the report document from the project snapshot. The snapshot is the
 * data already stored in `projects.data` and sent by the client, so the report
 * never depends on live reference tables.
 */
export function buildReportDocument({
  project,
  result,
  isFree,
}: ReportSnapshot): React.ReactElement<React.ComponentProps<typeof Document>> {
  const name = project.name || "Проект";
  const customServices = customServiceRows(result);

  return h(
    Document,
    {
      title: name,
      author: "MVP Calculator",
      creator: "MVP Calculator",
      producer: "MVP Calculator",
      language: "ru-RU",
    },
    h(
      Page,
      { size: "A4", style: styles.page, wrap: true },
      isFree
        ? h(Text, { style: styles.watermark, fixed: true }, "MVP Calculator Demo")
        : null,
      h(
        View,
        { style: styles.header },
        h(
          View,
          { style: styles.brand },
          h(Text, { style: styles.logoMark }, "MVP"),
          h(Text, { style: styles.brandName }, "MVP Calculator")
        ),
        h(Text, { style: styles.date }, formatDate(new Date()))
      ),
      h(Text, { style: styles.title }, name),
      project.description
        ? h(Text, { style: styles.description }, project.description)
        : null,
      h(
        View,
        { style: styles.summary },
        summaryItem("Стоимость", formatMoney(result.total_cost)),
        summaryItem("Человеко-часы", formatNumber(result.total_adjusted_hours)),
        summaryItem("Календарные дни", formatNumber(result.calendar_days), true)
      ),
      section("Сервисы", table(SERVICE_COLUMNS, serviceRows(result))),
      section("Роли", table(ROLE_COLUMNS, roleRows(result))),
      customServices.length > 0
        ? section(
            "Фиксированные стоимости кастомных сервисов",
            table(SERVICE_COLUMNS, customServices)
          )
        : null,
      h(
        View,
        { style: styles.footer, fixed: true },
        h(Text, {}, "Сгенерировано в MVP Calculator"),
        h(
          Text,
          {
            render: ({ pageNumber, totalPages }) =>
              `Стр. ${pageNumber} из ${totalPages}`,
          },
          ""
        )
      )
    )
  );
}
