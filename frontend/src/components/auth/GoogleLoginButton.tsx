import { googleLoginUrl } from "../../api/auth";
import { Button } from "../common/Button";

export function GoogleLoginButton() {
  return (
    <a href={googleLoginUrl()} className="w-full">
      <Button variant="secondary" className="w-full">
        Continue with Google
      </Button>
    </a>
  );
}
