import { githubLoginUrl } from '../../api/auth';
import { Button } from '../common/Button';

export function GitHubLoginButton() {
  return (
    <a href={githubLoginUrl()} className="w-full">
      <Button variant="primary" className="w-full">
        Continue with GitHub
      </Button>
    </a>
  );
}
