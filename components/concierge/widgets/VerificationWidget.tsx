"use client";

import { useState, useEffect } from "react";
import { Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useConcierge } from "@/contexts/ConciergeContext";
import { CardShell } from "./shared";

export function VerificationWidget({ onMessages }: { onMessages: (msgs: string[]) => void }) {
  const t = useTranslations("concierge");
  const { config, updateConfig } = useConcierge();
  const { scraped } = config;

  const [editHours, setEditHours] = useState<Record<string, string>>(scraped.hours);
  const [editTimezone, setEditTimezone] = useState(scraped.timezone);
  const [editLocation, setEditLocation] = useState(scraped.location);
  const [editAddress, setEditAddress] = useState(scraped.address ?? "");

  useEffect(() => {
    setEditAddress(scraped.address ?? "");
  }, [scraped.address]);

  const handleHolidayChoice = (yes: boolean) => {
    updateConfig({
      scraped: {
        ...scraped,
        hours: editHours,
        timezone: editTimezone,
        location: editLocation,
        address: editAddress.trim(),
      },
    });
    if (yes) {
      onMessages(["Yes, load public holidays"]);
    } else {
      onMessages(["No, skip holidays"]);
    }
  };

  const days = Object.keys(editHours);

  return (
    <CardShell>
      <div className="space-y-4">
        <div>
          <label htmlFor="verify-e911-address" className="block text-xs font-medium text-gray-600 mb-1">{t("verification.e911Label")}</label>
          <p className="text-xs text-gray-500 mb-1.5">{t("verification.e911Hint")}</p>
          <textarea
            id="verify-e911-address"
            value={editAddress}
            onChange={(e) => setEditAddress(e.target.value)}
            rows={3}
            placeholder={t("verification.e911Placeholder")}
            className="w-full px-2.5 py-1.5 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-white resize-y min-h-[4rem]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="verify-location" className="block text-xs font-medium text-gray-600 mb-1">{t("verification.locationLabel")}</label>
            <input
              id="verify-location"
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
              className="w-full px-2.5 py-1.5 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-white"
            />
          </div>
          <div>
            <label htmlFor="verify-timezone" className="block text-xs font-medium text-gray-600 mb-1">{t("verification.timezoneLabel")}</label>
            <input
              id="verify-timezone"
              value={editTimezone}
              onChange={(e) => setEditTimezone(e.target.value)}
              className="w-full px-2.5 py-1.5 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-white"
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t("verification.businessHours")}</p>
          <div className="space-y-1.5 bg-white border border-[#e8eaed] rounded-[16px] overflow-hidden">
            {days.map((day) => (
              <div key={day} className="flex items-center gap-3 px-3 py-1.5 border-b border-[#f1f3f4] last:border-0">
                <span className="text-xs font-medium text-gray-700 w-24 shrink-0">{day}</span>
                <input
                  value={editHours[day]}
                  onChange={(e) => setEditHours((h) => ({ ...h, [day]: e.target.value }))}
                  aria-label={`${day} hours`}
                  className="flex-1 text-xs px-2 py-1 border border-[#dadce0] rounded focus:outline-none focus:ring-1 focus:ring-[#1a73e8] bg-white"
                />
              </div>
            ))}
          </div>
        </div>

        {scraped.phones.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {t("verification.phoneNumbersFound")}
            </p>
            <div className="flex flex-wrap gap-2">
              {scraped.phones.map((p) => (
                <span key={p} className="flex items-center gap-1.5 px-2.5 py-1 bg-[#e8f0fe] text-[#1a73e8] rounded-full text-xs font-medium">
                  <Phone className="w-3 h-3" aria-hidden="true" /> {p}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-[#f1f3f4]">
          <p className="text-sm font-medium text-gray-800 mb-3">
            {t("verification.loadHolidaysPrompt")}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handleHolidayChoice(true)}
              className="flex-1 py-2 text-sm font-medium border border-[#1a73e8] text-[#1a73e8] rounded-lg hover:bg-[#e8f0fe] transition-colors"
            >
              {t("verification.yesLoadHolidays")}
            </button>
            <button
              onClick={() => handleHolidayChoice(false)}
              className="flex-1 py-2 text-sm font-medium border border-[#dadce0] text-gray-600 rounded-lg hover:bg-[#f1f3f4] transition-colors"
            >
              {t("verification.skipForNow")}
            </button>
          </div>
        </div>
      </div>
    </CardShell>
  );
}
