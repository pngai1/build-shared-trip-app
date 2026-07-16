import {
  getInitialLanguage,
  languageStorageKey,
  languageMeta,
  saveLanguage,
  ui
} from "./i18n.js?v=v-d7e4948348d0";
import { getTripResources } from "./trip-resources.js?v=v-d7e4948348d0";

const languageSelect = document.getElementById("language-select");
const paymentContent = document.getElementById("payment-page-content");
const appsContent = document.getElementById("apps-page-content");
let currentLanguage = getInitialLanguage();

render();
registerServiceWorker();
languageSelect.addEventListener("change", () => {
  currentLanguage = languageSelect.value;
  saveLanguage(currentLanguage);
  render();
});

window.addEventListener("storage", (event) => {
  if (event.key !== languageStorageKey() || !event.newValue || event.newValue === currentLanguage) return;
  currentLanguage = event.newValue;
  render();
});

function render() {
  document.documentElement.lang = languageMeta(currentLanguage).htmlLang;
  document.title = `${ui(currentLanguage, "travelResources")} · ${ui(currentLanguage, "brandName")}`;
  languageSelect.value = currentLanguage;
  languageSelect.setAttribute("aria-label", ui(currentLanguage, "language"));
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = ui(currentLanguage, node.dataset.i18n);
  });

  const resources = getTripResources(currentLanguage);
  renderPayments(resources.payment);
  renderApps(resources.apps);
}

function renderPayments(payment) {
  paymentContent.replaceChildren(textElement("p", "resource-summary", payment.summary));
  const grid = element("div", "payment-grid");
  payment.facilities.forEach((facility) => {
    const disclosure = element("details", "payment-item");
    const summary = element("summary", "payment-item__summary");
    const heading = element("span", "payment-item__heading");
    heading.append(
      textElement("span", "payment-item__icon", facility.icon),
      textElement("strong", "", facility.title)
    );
    summary.append(heading, textElement("span", "payment-item__method", facility.summary));
    disclosure.append(summary, textElement("p", "payment-item__details", facility.details));
    if (facility.sources.length) {
      const links = element("div", "resource-links");
      facility.sources.forEach((source) => links.append(externalAnchor(source.label, source.url)));
      disclosure.append(links);
    }
    grid.append(disclosure);
  });
  paymentContent.append(grid);
}

function renderApps(apps) {
  appsContent.replaceChildren();
  const grid = element("div", "apps-grid");
  apps.items.forEach((app) => {
    const destination = externalAnchor("", app.url, "app-card");
    const top = element("span", "app-card__top");
    top.append(
      textElement("span", "app-card__icon", app.icon),
      textElement("span", "app-card__category", app.category)
    );
    if (app.note) top.append(textElement("span", "app-card__note", app.note));
    destination.append(
      top,
      textElement("strong", "app-card__name", app.name),
      textElement("span", "app-card__description", app.description),
      textElement("span", "app-card__store", ui(currentLanguage, "openAppStore"))
    );
    destination.setAttribute("aria-label", `${app.name} · ${ui(currentLanguage, "openAppStore")}`);
    grid.append(destination);
  });
  appsContent.append(grid, textElement("p", "wallet-note", apps.walletNote));
}

function externalAnchor(label, url, className = "resource-link") {
  const link = element("a", className);
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  return link;
}

function element(tag, className = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function textElement(tag, className, text) {
  const node = element(tag, className);
  node.textContent = text || "";
  return node;
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.warn("Service worker registration failed", error);
    });
  });
}
