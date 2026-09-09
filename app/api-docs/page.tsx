import { SwaggerUi } from "@/components/docs/swagger-ui";

export const metadata = {
  title: "API Docs | MVP Calculator",
  description: "Swagger UI для API проекта MVP Calculator",
};

export default function ApiDocsPage() {
  return <SwaggerUi />;
}
