'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import {
  CheckCircle, XCircle, Shield, Calendar, Award, Building2, Hash,
  Loader2, GraduationCap, Mail, Globe, MapPin, User, FileText, BadgeCheck,
} from 'lucide-react';

interface VerificationData {
  verified: boolean;
  certificateId: string;
  holderName: string;
  eventName: string;
  eventId: string;
  certificateTitle: string;
  certificateType: string;
  issuingOrganization: string;
  issueDate: string;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{children}</h3>
  );
}

function OrgDetail({ icon: Icon, value }: { icon: React.ElementType; value: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-blue-100">
      <Icon className="w-4 h-4 text-blue-300 flex-shrink-0" />
      <span>{value}</span>
    </div>
  );
}

export default function CertificateVerifyPage() {
  const params = useParams();
  const code = params.code as string;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VerificationData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/events/certificates/verify/${code}`);
        const json = await res.json();
        if (res.ok && json.success && json.data?.verified) {
          setData(json.data);
        } else {
          setError(json.message || 'Certificate not found or invalid.');
        }
      } catch {
        setError('Unable to verify certificate. Please try again later.');
      } finally {
        setLoading(false);
      }
    })();
  }, [code]);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0F2573] via-[#041D56] to-[#01082D]" />
      <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />

      <div className="relative z-10 min-h-screen flex flex-col">

        {/* Top Nav Bar */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg">
              <Image src="/sgt-logo.png" alt="SGT University" width={30} height={30} />
            </div>
            <div>
              <h2 className="text-white font-bold text-base leading-tight">SGT University</h2>
              <p className="text-blue-300 text-[11px]">University Management System</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full">
            <Shield className="w-3.5 h-3.5 text-blue-300" />
            <span className="text-blue-200 text-xs font-medium">Certificate Verification Portal</span>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">

          {/* Page Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white">Certificate Verification</h1>
            <p className="text-blue-300 text-sm mt-2">Verify the authenticity of certificates issued by SGT University Event Portal</p>
          </div>

          {/* Main Card */}
          <div className="w-full max-w-5xl">

            {loading ? (
              <div className="bg-white rounded-2xl shadow-2xl flex flex-col items-center justify-center py-24">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-5">
                  <Loader2 className="w-8 h-8 text-[#0F2573] animate-spin" />
                </div>
                <p className="text-gray-700 font-semibold text-lg">Verifying Certificate...</p>
                <p className="text-gray-400 text-sm mt-1">Please wait while we check the records</p>
              </div>
            ) : error ? (
              <div className="bg-white rounded-2xl shadow-2xl flex flex-col items-center justify-center py-20 px-8">
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-5">
                  <XCircle className="w-10 h-10 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h2>
                <p className="text-base text-gray-500 text-center max-w-md">{error}</p>
                <div className="mt-8 bg-red-50 rounded-xl border border-red-100 p-5 w-full max-w-lg">
                  <div className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-700">Invalid Certificate</p>
                      <p className="text-sm text-red-500 mt-1">This certificate could not be verified. It may be invalid, revoked, or not yet issued. If you believe this is an error, please contact the event organizer at info@sgtuniversity.ac.in.</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : data ? (
              <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                {/* Top status bar */}
                <div className="bg-gradient-to-r from-emerald-500 to-green-600 px-8 py-5 flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-white">Certificate Verified</h2>
                      <BadgeCheck className="w-5 h-5 text-green-200" />
                    </div>
                    <p className="text-green-100 text-sm">This certificate is authentic and has been verified successfully</p>
                  </div>
                  <div className="ml-auto text-right hidden sm:block">
                    <p className="text-green-100 text-xs">Verified on</p>
                    <p className="text-white text-sm font-semibold">{new Date().toLocaleDateString('en-IN', { dateStyle: 'medium' })}</p>
                  </div>
                </div>

                {/* Two-column body */}
                <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">

                  {/* Left: Certificate + Event Details */}
                  <div className="p-8 space-y-8">
                    {/* Certificate Details */}
                    <div>
                      <SectionTitle>Certificate Details</SectionTitle>
                      <div className="bg-gray-50 rounded-xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
                        <DetailRow icon={Award} label="Certificate Title" value={data.certificateTitle} />
                        <DetailRow icon={User} label="Certificate Holder" value={data.holderName} highlight />
                        <DetailRow
                          icon={FileText}
                          label="Certificate Type"
                          value={data.certificateType ===
   'participation' ? 'Certificate of Participation' : data.certificateType ===
   'winner' ? 'Certificate of Achievement' : data.certificateType}
                          badge
                        />
                        <DetailRow
                          icon={Calendar}
                          label="Date of Issue"
                          value={new Date(data.issueDate).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        />
                      </div>
                    </div>

                    {/* Event Details */}
                    <div>
                      <SectionTitle>Event Information</SectionTitle>
                      <div className="bg-gray-50 rounded-xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
                        <DetailRow icon={Calendar} label="Event / Program Name" value={data.eventName} />
                        <DetailRow icon={Hash} label="Event ID" value={data.eventId} mono />
                      </div>
                    </div>

                    {/* Verification ID */}
                    <div>
                      <SectionTitle>Verification ID</SectionTitle>
                      <div className="bg-gray-900 rounded-xl p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Unique Certificate Code</p>
                          <p className="text-xs font-mono text-gray-300 break-all">{data.certificateId}</p>
                        </div>
                        <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Shield className="w-5 h-5 text-green-400" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Issuing Organization */}
                  <div className="p-8 space-y-8 bg-gray-50/50">
                    {/* Organization Card */}
                    <div>
                      <SectionTitle>Issuing Organization</SectionTitle>
                      <div className="bg-gradient-to-br from-[#0F2573] to-[#266CA9] rounded-xl p-6 text-white">
                        <div className="flex items-center gap-4 mb-6">
                          <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                            <Image src="/sgt-logo.png" alt="SGT University" width={40} height={40} />
                          </div>
                          <div>
                            <p className="font-bold text-lg leading-tight">SGT University</p>
                            <p className="text-blue-200 text-xs mt-0.5">Shree Guru Gobind Singh Tricentenary University</p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <OrgDetail icon={MapPin} value="Budhera, Gurugram, Haryana – 122505" />
                          <OrgDetail icon={Mail} value="info@sgtuniversity.ac.in" />
                          <OrgDetail icon={Globe} value="www.sgtuniversity.ac.in" />
                        </div>
                        <div className="mt-6 pt-5 border-t border-white/20">
                          <p className="text-blue-200 text-xs">NAAC Accreditation</p>
                          <p className="text-white font-bold text-lg mt-0.5">Grade A+</p>
                          <p className="text-blue-300 text-xs mt-1">Established under Haryana State Act 2013</p>
                        </div>
                      </div>
                    </div>

                    {/* Security Note */}
                    <div>
                      <SectionTitle>Verification Info</SectionTitle>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3 bg-white rounded-xl border border-gray-100 p-4">
                          <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">Authentic & Valid</p>
                            <p className="text-xs text-gray-500 mt-0.5">This certificate was officially issued by SGT University and is recorded in our system.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 bg-white rounded-xl border border-gray-100 p-4">
                          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Shield className="w-5 h-5 text-[#0F2573]" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">Tamper-Proof Verification</p>
                            <p className="text-xs text-gray-500 mt-0.5">Each certificate has a unique ID. Any alteration would invalidate the certificate.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 bg-white rounded-xl border border-gray-100 p-4">
                          <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
                            <GraduationCap className="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">Event Portal Issued</p>
                            <p className="text-xs text-gray-500 mt-0.5">Issued via SGT University Event Management System. Contact events@sgtuniversity.ac.in for support.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Footer */}
            <div className="text-center mt-6 space-y-1">
              <p className="text-blue-200 text-sm">
                Powered by the <strong className="text-white">SGT University Event Portal</strong>
              </p>
              <p className="text-blue-400/60 text-xs">
                &copy; {new Date().getFullYear()} SGT University. All rights reserved. &nbsp;|&nbsp; info@sgtuniversity.ac.in
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  mono,
  highlight,
  badge,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
  badge?: boolean;
}) {
  return (
    <div className="flex items-center gap-3.5 px-4 py-3.5">
      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm border border-gray-100">
        <Icon className="w-4 h-4 text-[#266CA9]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{label}</p>
        {badge ? (
          <span className="inline-block mt-1 px-2.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full capitalize">{value}</span>
        ) : (
          <p className={`mt-0.5 break-all ${mono ? 'font-mono text-[11px] text-gray-500' : highlight ? 'text-sm font-bold text-[#0F2573]' : 'text-sm font-semibold text-gray-800'}`}>
            {value}
          </p>
        )}
      </div>
    </div>
  );
}
