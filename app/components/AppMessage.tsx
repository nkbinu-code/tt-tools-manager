"use client";

export default function AppMessage({ message, onClose }: any) {
  if (!message) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.45)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 99999,
      }}
    >
      <div
        style={{
          width: 420,
          maxWidth: "90%",
          background: "#fff",
          borderRadius: 20,
          padding: 30,
          textAlign: "center",
        }}
      >
        <h2>{message.title}</h2>

        <p>{message.message}</p>

        <button
          className="btn-blue"
          onClick={onClose}
        >
          OK
        </button>
      </div>
    </div>
  );
}