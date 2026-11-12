import { OperatorConsole } from './operator-console';

export const dynamic = 'force-dynamic';

export default function Page() {
  const publicApiUrl = process.env.ORDERFLOW_PUBLIC_API_URL ?? 'http://localhost:8085';
  return <OperatorConsole publicApiUrl={publicApiUrl} />;
}
