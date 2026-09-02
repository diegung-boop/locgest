import React from "react";
import { Organization } from "@/types/locgest";

interface LetterheadContainerProps {
  organization: Organization;
  documentTitle?: string;
  children: React.ReactNode;
  id?: string;
  className?: string;
}

export const LetterheadContainer: React.FC<LetterheadContainerProps> = ({
  organization,
  documentTitle,
  children,
  id,
  className = "",
}) => {
  const isEnabled = organization?.letterhead_enabled !== false;
  const watermarkUrl = isEnabled ? organization?.letterhead_watermark_url : null;
  const opacity = organization?.letterhead_watermark_opacity ?? 0.10;

  const headerUrl = isEnabled ? organization?.letterhead_header_url : null;
  const headerText = organization?.letterhead_header_text || organization?.name;

  const footerUrl = isEnabled ? organization?.letterhead_footer_url : null;
  const footerText = organization?.letterhead_footer_text;

  const formatAddressLine = (org: Organization) => {
    const parts = [org?.address_st, org?.address_number, org?.address_neighborhood].filter(Boolean);
    const cityState = [org?.address_city, org?.address_estate].filter(Boolean).join("/");
    if (cityState) parts.push(cityState);
    const line = parts.join(", ");
    const full = org?.address_zipcode ? `${line}${line ? " - " : ""}CEP: ${org.address_zipcode}` : line;
    const phone = org?.phone ? ` — FONE: ${org.phone}` : "";
    const email = org?.email ? ` — ${org.email}` : "";
    return `${full}${phone}${email}`.toUpperCase();
  };

  return (
    <div
      id={id}
      className={`bg-white text-black relative p-8 max-w-[794px] mx-auto min-h-[1120px] flex flex-col justify-between overflow-hidden shadow-xl border border-neutral-200 font-serif ${className}`}
    >
      {/* Centered Watermark Layer */}
      {watermarkUrl && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none p-12 z-0"
          style={{ opacity }}
        >
          <img
            src={watermarkUrl}
            alt="Marca-d'Água"
            className="max-w-[75%] max-h-[65%] object-contain"
          />
        </div>
      )}

      {/* Header Layer */}
      <div id="contract-html-header" className="relative z-10 border-b border-neutral-300 pb-3 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-sm uppercase tracking-wider text-neutral-900">
              {organization?.name || "LOCADORA"}
            </h1>
            <p className="text-[9px] text-neutral-500 italic mt-0.5">Plataforma de Gestão de Locações & Equipamentos</p>
          </div>
          {organization?.logo_url && (
            <img
              id="locadora-logo-img"
              src={organization.logo_url}
              alt="Logo"
              className="object-contain max-h-[130px] max-w-[280px]"
            />
          )}
        </div>
      </div>

      {/* Document Content Slot */}
      <div className="relative z-10 flex-1 space-y-4">
        {children}
      </div>

      {/* Footer Layer */}
      <div id="contract-html-footer" className="relative z-10 border-t border-neutral-300 pt-3 mt-8 text-center text-[8px] text-neutral-500 font-bold uppercase tracking-wider">
        {footerUrl ? (
          <img src={footerUrl} alt="Rodapé" className="w-full max-h-14 object-contain" />
        ) : (
          <p>{footerText || formatAddressLine(organization)}</p>
        )}
      </div>
    </div>
  );
};
