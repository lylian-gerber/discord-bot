import { AuthForm } from "../AuthForm";
import { signup } from "../actions";

export default function SignupPage() {
  return <AuthForm mode="signup" action={signup} />;
}
