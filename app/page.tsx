"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Clock, Target, BarChart3 } from "lucide-react";

export default function Home() {
  const { user } = useAuth();
  const t = useTranslations("home");

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <section className="flex-1">
        <div className="container mx-auto px-4 py-24 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            {t("heroTitleLine1")}
            <br />
            <span className="text-primary">{t("heroTitleLine2")}</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            {t("heroSubtitle")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {user ? (
              <Link href="/projects/new">
                <Button size="lg" className="text-lg px-8">
                  {t("createProject")}
                </Button>
              </Link>
            ) : (
              <Link href="/register">
                <Button size="lg" className="text-lg px-8">
                  {t("tryFree")}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      <section id="benefits" className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            {t("benefitsTitle")}
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-background rounded-lg p-6 border text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {t("benefits.time.title")}
              </h3>
              <p className="text-muted-foreground">
                {t("benefits.time.text")}
              </p>
            </div>
            <div className="bg-background rounded-lg p-6 border text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {t("benefits.accuracy.title")}
              </h3>
              <p className="text-muted-foreground">
                {t("benefits.accuracy.text")}
              </p>
            </div>
            <div className="bg-background rounded-lg p-6 border text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {t("benefits.transparency.title")}
              </h3>
              <p className="text-muted-foreground">
                {t("benefits.transparency.text")}
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {t("footer.copyright")}
          </p>
          <div className="flex gap-6">
            <a
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground transition"
            >
              {t("footer.privacy")}
            </a>
            <a
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground transition"
            >
              {t("footer.terms")}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
