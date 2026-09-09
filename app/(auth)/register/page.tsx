import { Header } from "@/components/layout/header";
import { SignUpForm } from "@/components/auth/sign-up-form";

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center p-4">
        <SignUpForm />
      </div>
    </div>
  );
}
