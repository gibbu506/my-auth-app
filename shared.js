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