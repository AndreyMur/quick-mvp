"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Clock, Target, BarChart3 } from "lucide-react";

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <section className="flex-1">
        <div className="container mx-auto px-4 py-24 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            Узнайте бюджет и сроки MVP
            <br />
            <span className="text-primary">до начала разработки</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Пошаговый конструктор расчёта стоимости цифровых продуктов.
            Рассчитайте стоимость и сроки создания MVP за 5 минут.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {user ? (
              <Link href="/projects/new">
                <Button size="lg" className="text-lg px-8">
                  Создать проект
                </Button>
              </Link>
            ) : (
              <Link href="/register">
                <Button size="lg" className="text-lg px-8">
                  Попробовать бесплатно
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      <section id="benefits" className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            Почему MVP Calculator?
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-background rounded-lg p-6 border text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Экономия времени</h3>
              <p className="text-muted-foreground">
                Расчёт за минуты вместо недель оценки
              </p>
            </div>
            <div className="bg-background rounded-lg p-6 border text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Точность оценки</h3>
              <p className="text-muted-foreground">
                Нормативы на основе реальных проектов
              </p>
            </div>
            <div className="bg-background rounded-lg p-6 border text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Прозрачность</h3>
              <p className="text-muted-foreground">
                Детальная смета по ролям и сервисам
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © 2026 MVP Calculator. Все права защищены.
          </p>
          <div className="flex gap-6">
            <a
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground transition"
            >
              Политика конфиденциальности
            </a>
            <a
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground transition"
            >
              Условия использования
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
