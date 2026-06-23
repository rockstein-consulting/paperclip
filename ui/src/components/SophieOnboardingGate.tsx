import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useCompany } from "@/context/CompanyContext";
import { authApi } from "@/api/auth";
import { sophiePreferencesApi } from "@/api/sophie-preferences";
import { queryKeys } from "@/lib/queryKeys";
import { SophieOnboardingWizard } from "./SophieOnboardingWizard";

export function SophieOnboardingGate() {
  const { selectedCompanyId } = useCompany();
  const [dismissed, setDismissed] = useState(false);

  const sessionQuery = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });

  const prefsQuery = useQuery({
    queryKey: ["sophie-preferences", selectedCompanyId],
    queryFn: () => sophiePreferencesApi.getMap(selectedCompanyId!),
    enabled: !!selectedCompanyId && !!sessionQuery.data,
  });

  if (!selectedCompanyId || dismissed) return null;
  if (sessionQuery.isLoading || prefsQuery.isLoading) return null;
  if (!sessionQuery.data) return null;
  if (prefsQuery.data?.onboarding_completed === true) return null;

  return (
    <SophieOnboardingWizard
      companyId={selectedCompanyId}
      userName={sessionQuery.data.user.name ?? "Guten Tag"}
      onComplete={() => setDismissed(true)}
    />
  );
}
