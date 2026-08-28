"use client";

import PageHeader from "@/components/PageHeader";
import CompanyForm from "@/components/CompanyForm";

export default function NewCompanyPage() {
  return (
    <>
      <PageHeader crumb="Empresas" title="Nueva empresa" />
      <div className="min-h-0 flex-1 overflow-auto px-4 pb-12 pt-6 lg:px-9 lg:pt-8">
        <div className="panel max-w-[640px] p-7">
          <div className="text-[15px] font-semibold tracking-[-0.01em]">Datos de la cuenta</div>
          <div className="mb-6 mt-1 text-[12.5px] text-ink-350">
            Las cuentas alimentan el selector de contactos y deals.
          </div>
          <CompanyForm />
        </div>
      </div>
    </>
  );
}
