const tabs = document.querySelectorAll("[data-preview-tab]");
const panes = document.querySelectorAll("[data-preview-pane]");

function activatePreview(target) {
  tabs.forEach((tab) => {
    const isActive = tab.dataset.previewTab === target;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  panes.forEach((pane) => {
    const isActive = pane.dataset.previewPane === target;
    pane.hidden = !isActive;
    pane.classList.toggle("is-active", isActive);
  });
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => activatePreview(tab.dataset.previewTab));
});

document.querySelectorAll("[data-scroll-to]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector(button.dataset.scrollTo)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
});
