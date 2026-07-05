"use client";

type StatementFooterProps = {
  shop?: string;
};

const shopDetails: Record<string, { title: string; address: string; phone: string }> = {
  "Karuvannur": {
    title: "KARUVANNUR",
    address: "Near St. Marys Church, Karuvannur, Thrissur.",
    phone: "6282778096",
  },
  "Ollur": {
    title: "OLLUR",
    address: "Gramodharanam Rd, Ollur, Thrissur.",
    phone: "8589874904",
  },
  "Kachery": {
    title: "KACHERY",
    address: "Kachery Centre, Kachery, Thrissur.",
    phone: "9744774904",
  },
  "Mulayam Rd": {
    title: "MULAYAM",
    address: "Mulayam Jn, Mulayam Rd, Thrissur.",
    phone: "8086774904",
  },
  "Mulayam": {
    title: "MULAYAM",
    address: "Mulayam Jn, Mulayam Rd, Thrissur.",
    phone: "8086774904",
  },
  "Pattikkad": {
    title: "PATTIKKAD",
    address: "Peechi Rd, Pattikkad, Thrissur.",
    phone: "9539712465",
  },
};

export default function StatementFooter({ shop }: StatementFooterProps) {
  const details =
    shopDetails[String(shop || "").trim()] ||
    shopDetails["Karuvannur"];

  return (
    <div style={footerWrap}>
      <div style={topLine} />

      <div style={thanks}>
        Thank you for choosing
        <br />
        <strong>Tried & True Rent a Tool</strong>
      </div>

      <div style={shopBox}>
        <div style={shopTitle}>📍 {details.title}</div>
        <div style={address}>{details.address}</div>
        <div style={phone}>Mob: {details.phone}</div>
      </div>

      <div style={smallText}>
        ഗുണമേന്മയുള്ള ഉപകരണങ്ങൾ • ന്യായമായ വാടക • വിശ്വസനീയമായ സേവനം
      </div>
      <div style={copyright}>
        © 2026 Tried & True Tools Rentals. All rights reserved.
      </div>
    </div>
  );
}

const footerWrap: any = {
  marginTop: 26,
  textAlign: "center",
  color: "#0f172a",
};

const topLine: any = {
  height: 2,
  background: "#0057ff",
  opacity: 0.75,
  marginBottom: 16,
};

const thanks: any = {
  fontSize: 19,
  fontWeight: 800,
  color: "#0057ff",
  lineHeight: 1.35,
  marginBottom: 12,
};

const shopBox: any = {
  display: "inline-block",
  minWidth: 300,
  maxWidth: "100%",
  padding: "10px 18px",
  border: "1px solid #bfdbfe",
  borderRadius: 14,
  background: "#f8fbff",
  marginBottom: 10,
};

const shopTitle: any = {
  fontSize: 15,
  fontWeight: 950,
  color: "#0057ff",
  marginBottom: 4,
};

const address: any = {
  fontSize: 13,
  fontWeight: 750,
  color: "#334155",
};

const phone: any = {
  marginTop: 4,
  fontSize: 14,
  fontWeight: 950,
  color: "#0f172a",
};

const smallText: any = {
  marginTop: 6,
  fontSize: 12,
  color: "#0057ff",
  fontWeight: 800,
};

const copyright: any = {
  marginTop: 4,
  fontSize: 11,
  color: "#64748b",
  fontWeight: 700,
};
