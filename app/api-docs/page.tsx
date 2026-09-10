import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SwaggerUi } from "@/components/docs/swagger-ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("apiDocs");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default function ApiDocsPage() {
  return <SwaggerUi />;
}
