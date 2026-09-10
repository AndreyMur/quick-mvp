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

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(
    Math.round(value)
  );
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
      { size: "A4", style: styles.page },
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
        summaryItem("Стоимость", `${formatNumber(result.total_cost)} у.е.`),
        summaryItem("Человеко-часы", formatNumber(result.total_adjusted_hours)),
        summaryItem("Календарные дни", formatNumber(result.calendar_days), true)
      )
    )
  );
}
