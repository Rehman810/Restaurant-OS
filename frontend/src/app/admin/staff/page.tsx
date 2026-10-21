"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { StaffPageView } from "@/modules/staff/StaffPageView";
import { useBranch } from "@/modules/branches/BranchContext";

export default function StaffPage() {
  const searchParams = useSearchParams();
  const { selection, branches, setSelection } = useBranch();

  useEffect(() => {
    const focus = searchParams.get("focusBranch");
    if (focus && branches.some((b) => b.id === focus)) {
      setSelection(focus);
    }
  }, [searchParams, branches, setSelection]);

  const branchOptions = branches.map((b) => ({ id: b.id, name: b.name, address: b.address }));

  return <StaffPageView branchOptions={branchOptions} branchSelection={selection} />;
}
