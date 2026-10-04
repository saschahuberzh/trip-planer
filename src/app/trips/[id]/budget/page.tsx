import type { Metadata } from "next";
import { BudgetScreen } from "@/components/budget/BudgetScreen";

export const metadata: Metadata = { title: "Budget" };

export default function Page() {
  return <BudgetScreen />;
}
