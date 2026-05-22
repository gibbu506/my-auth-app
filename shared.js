/* LOADING SCREEN */
document.body.insertAdjacentHTML("afterbegin", `
  <div id="loader" style="
    position: fixed;
    inset: 0;
    background: #0a0a0a;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    gap: 20px;
  ">
    <div style="
      font-family: 'Syne', sans-serif;
      font-size: 24px;
      font-weight: 800;
      color: #f0f0f0;
      display: flex;
      align-items: center;
      gap: 10px;
    ">
      <span style="
        width: 10px;
        height: 10px;
        background: #c8f55a;
        border-radius: 50%;
        display: inline-block;
      "></span>
      YourApp
    </div>
    <div style="
      width: 36px;
      height: 36px;
      border: 2px solid #222;
      border-top-color: #c8f55a;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    "></div>
    <div style="
      font-family: 'DM Sans', sans-serif;
      font-size: 13px;
      color: #555;
    " id="loaderText">Starting up...</div>
  </div>

  <style>
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
`);

// Cycle messages
const messages = [
  "Starting up...",
  "Connecting to server...",
  "Almost ready...",
  "Loading your data..."
];

let i = 0;
const loaderText = document.getElementById("loaderText");
const msgInterval = setInterval(() => {
  i = (i + 1) % messages.length;
  loaderText.textContent = messages[i];
}, 2000);

// Hide loader when page is ready
window.addEventListener("load", () => {
  clearInterval(msgInterval);
  const loader = document.getElementById("loader");
  loader.style.transition = "opacity 0.5s ease";
  loader.style.opacity = "0";
  setTimeout(() => loader.style.display = "none", 500);
});

/* PWA SERVICE WORKER */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js")
    .then(() => console.log("SW registered"))
    .catch(err => console.log("SW error:", err));
}
/* COOKIE CONSENT BANNER */
if (!localStorage.getItem("cookieAccepted")) {
  document.body.insertAdjacentHTML("beforeend", `
    <div id="cookieBanner" style="
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #111;
      border: 1px solid #222;
      border-radius: 14px;
      padding: 18px 24px;
      display: flex;
      align-items: center;
      gap: 20px;
      z-index: 99999;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      max-width: 500px;
      width: 90%;
    ">
      <div style="flex:1">
        <div style="
          font-family: 'Syne', sans-serif;
          font-size: 14px;
          font-weight: 700;
          color: #f0f0f0;
          margin-bottom: 4px;
        ">🍪 We use cookies</div>
        <div style="
          font-family: 'DM Sans', sans-serif;
          font-size: 12px;
          color: #555;
          line-height: 1.5;
        ">We use cookies to keep you logged in and improve your experience.</div>
      </div>
      <div style="display:flex; gap:8px; flex-shrink:0;">
        <button onclick="declineCookies()" style="
          padding: 8px 16px;
          background: none;
          border: 1px solid #333;
          border-radius: 8px;
          color: #555;
          font-family: 'DM Sans', sans-serif;
          font-size: 12px;
          cursor: pointer;
        ">Decline</button>
        <button onclick="acceptCookies()" style="
          padding: 8px 16px;
          background: #c8f55a;
          border: none;
          border-radius: 8px;
          color: #0a0a0a;
          font-family: 'Syne', sans-serif;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        ">Accept</button>
      </div>
    </div>
  `);
}

function acceptCookies() {
  localStorage.setItem("cookieAccepted", "true");
  document.getElementById("cookieBanner").style.opacity = "0";
  setTimeout(() => document.getElementById("cookieBanner").remove(), 300);
}

function declineCookies() {
  localStorage.setItem("cookieAccepted", "false");
  document.getElementById("cookieBanner").style.opacity = "0";
  setTimeout(() => document.getElementById("cookieBanner").remove(), 300);
}