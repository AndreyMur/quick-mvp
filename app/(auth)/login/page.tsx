import { Header } from "@/components/layout/header";
import { SignInForm } from "@/components/auth/sign-in-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center p-4">
        <SignInForm />
      </div>
    </div>
  );
}
