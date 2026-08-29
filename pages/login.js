(function () {
  // Demo credentials (client-side only — for hackathon demo)
  const VALID_USER = "admin";
  const VALID_PASS = "admin";

  const form = document.getElementById("loginForm");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const togglePw = document.getElementById("togglePw");
  const submitBtn = document.getElementById("submitBtn");
  const alertBox = document.getElementById("alertBox");
  const rememberCheck = document.getElementById("remember");
  const eye = togglePw.querySelector(".icon-eye");
  const eyeOff = togglePw.querySelector(".icon-eye-off");

  // Theme (match dashboard)
  try {
    const saved = localStorage.getItem("smartpark-theme");
    if (saved === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else if (saved === "light") {
      document.documentElement.removeAttribute("data-theme");
    } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  } catch (e) {}

  // Already logged in? Go to dashboard
  try {
    if (sessionStorage.getItem("smartpark_auth") === "1" || localStorage.getItem("smartpark_auth") === "1") {
      window.location.href = "index.html";
      return;
    }
  } catch (e) {}

  // Show / hide password
  togglePw.addEventListener("click", function () {
    const show = passwordInput.type === "password";
    passwordInput.type = show ? "text" : "password";
    eye.style.display = show ? "none" : "block";
    eyeOff.style.display = show ? "block" : "none";
    togglePw.setAttribute("aria-label", show ? "Hide password" : "Show password");
    togglePw.title = show ? "Hide password" : "Show password";
  });

  function showError(msg) {
    alertBox.hidden = false;
    alertBox.textContent = msg;
  }

  function hideError() {
    alertBox.hidden = true;
    alertBox.textContent = "";
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    hideError();

    const user = (usernameInput.value || "").trim();
    const pass = passwordInput.value || "";

    submitBtn.disabled = true;
    submitBtn.querySelector(".btn-text").hidden = true;
    submitBtn.querySelector(".btn-loading").hidden = false;

    // Short delay so loading state is visible
    setTimeout(function () {
      if (user === VALID_USER && pass === VALID_PASS) {
        try {
          sessionStorage.setItem("smartpark_auth", "1");
          sessionStorage.setItem("smartpark_user", user);
          if (rememberCheck.checked) {
            localStorage.setItem("smartpark_auth", "1");
            localStorage.setItem("smartpark_user", user);
          }
        } catch (err) {}
        window.location.href = "index.html";
      } else {
        showError("Invalid username or password. Please try again.");
        submitBtn.disabled = false;
        submitBtn.querySelector(".btn-text").hidden = false;
        submitBtn.querySelector(".btn-loading").hidden = true;
        passwordInput.value = "";
        passwordInput.focus();
      }
    }, 400);
  });
})();
