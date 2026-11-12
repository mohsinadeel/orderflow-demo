import { OperatorConsole } from './operator-console';

export const dynamic = 'force-dynamic';

export default function Page() {
  const publicApiUrl = process.env.ORDERFLOW_PUBLIC_API_URL ?? 'http://localhost:8085';
  const basePath = process.env.ORDERFLOW_BASE_PATH ?? '';
  return <OperatorConsole publicApiUrl={publicApiUrl} basePath={basePath} />;
}
