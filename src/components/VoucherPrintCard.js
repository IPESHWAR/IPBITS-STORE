'use client';

import React from 'react';

export const STORE_QR_URL = 'https://ipbits.store';
export const QR_IMAGE_SRC = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(STORE_QR_URL)}&color=0b0c16`;

export function formatCardAmount(amountIqd) {
  return Number(amountIqd || 0).toLocaleString('en-US');
}

export default function VoucherPrintCard({ code, amountIqd, qrSrc = QR_IMAGE_SRC }) {
  return (
    <div className="card theme-card">
      <div className="header-row">
        <div className="brand-wrap">
          <div className="logo-box">
            <svg viewBox="0 0 100 100" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g transform="translate(50, 50) rotate(-45) translate(-50, -50)">
                <rect x="2" y="38" width="20" height="20" rx="2" fill="#ffffff"/>
                <rect x="29" y="38" width="67" height="20" rx="2" fill="#ffffff"/>
                <rect x="76" y="8" width="20" height="50" rx="2" fill="#ffffff"/>
                <rect x="46" y="8" width="50" height="20" rx="2" fill="#ffffff"/>
                <rect x="29" y="65" width="45" height="18" rx="2" fill="#ffffff"/>
              </g>
            </svg>
          </div>
          <div className="brand-text">
            <span className="brand-name">IPBITS</span>
            <span className="brand-sub">DIGITAL STORE</span>
          </div>
        </div>
        <div className="amount-box">
          <div className="amount-title">بهایێ کارتی</div>
          <div className="amount-val">{formatCardAmount(amountIqd)}<span>IQD</span></div>
        </div>
      </div>
      <div className="middle-row">
        <div className="code-container">
          <div className="code-top">
            <span className="code-lbl-en">CARD CODE</span>
            <span className="code-lbl-ku">جهێ تاشینا کۆدی</span>
          </div>
          <div className="code-val">{code}</div>
        </div>
        <div className="qr-container">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="qr-img" src={qrSrc} alt="QR Code" />
          <span className="qr-text">SCAN STORE</span>
        </div>
      </div>
      <div className="footer-row">
        <span className="footer-ku">کارتا فەرمی یا زێدەکرنا باڵانسی</span>
        <span className="footer-web">WWW.IPBITS.STORE</span>
      </div>
    </div>
  );
}
