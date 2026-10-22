import { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { needsRestaurantName } from "./settings-validate";
import { getStoreSettings } from "./settings-data";

export type OnboardingStep = {
  id: string;
  complete: boolean;
  label: string;
};

export async function getOnboardingStatus() {
  const settings = await getStoreSettings();
  const [branchCount, owner] = await Promise.all([
    prisma.branch.count({ where: { isActive: true } }),
    prisma.user.findFirst({
      where: { isOwner: true, isActive: true, role: Role.ADMIN },
      select: { id: true },
    }),
  ]);

  const steps: OnboardingStep[] = [
    {
      id: "store_name",
      complete: !needsRestaurantName(settings.storeName),
      label: "Add your restaurant name",
    },
    {
      id: "branch",
      complete: branchCount > 0,
      label: "Set up your main branch",
    },
    {
      id: "owner",
      complete: Boolean(owner),
      label: "Confirm the owner account",
    },
  ];

  const complete = steps.every((step) => step.complete);
  return { complete, steps, storeName: settings.storeName };
}
