const PALETTE_SIZE = 5;
const DEFAULT_PALETTE = ["#71816B", "#A9B49A", "#DFCFB0", "#D59A7C", "#8B6E65"];
let palette = [...DEFAULT_PALETTE];
let locked = new Set();
let palettes = [];
let toastTimer;
let captureStream = null;
const $ = (selector) => document.querySelector(selector);

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const channel = (n) => {
    const color = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`.toUpperCase();
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16));
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = (h * 60 + 360) % 360;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

function makePalette() {
  const mode = $("#harmony").value;
  const hue = randomInt(360);
  const saturation = 34 + randomInt(34);
  const lightness = 38 + randomInt(25);
  const offsets = {
    analogous: [-42, -20, 0, 20, 42],
    complementary: [-18, 0, 8, 166, 188],
    triadic: [-12, 0, 12, 108, 228],
    monochromatic: [0, 0, 0, 0, 0],
    random: [0, 0, 0, 0, 0],
  }[mode];
  return Array.from({ length: PALETTE_SIZE }, (_, index) => {
    if (mode === "random") {
      return hslToHex(randomInt(360), 30 + randomInt(51), 32 + randomInt(42));
    }
    const shade = mode === "monochromatic" ? [25, 38, 51, 65, 78][index] : lightness + [14, 5, 0, -6, -13][index];
    const chroma = mode === "monochromatic" ? saturation : Math.min(76, saturation + [-5, 4, 0, 6, -7][index]);
    return hslToHex((hue + offsets[index] + 360) % 360, chroma, Math.max(19, Math.min(83, shade)));
  });
}

function renderPalette() {
  const grid = $("#paletteGrid");
  grid.innerHTML = "";
  palette.forEach((color, index) => {
    const tile = document.createElement("article");
    tile.className = "color-tile";
    const swatch = document.createElement("div");
    swatch.className = "swatch";
    swatch.style.setProperty("--swatch", color);

    const lockButton = document.createElement("button");
    lockButton.className = `tile-lock${locked.has(index) ? " is-locked" : ""}`;
    lockButton.type = "button";
    lockButton.title = locked.has(index) ? "Mở khóa màu" : "Giữ màu này khi tạo lại";
    lockButton.setAttribute("aria-label", lockButton.title);
    lockButton.textContent = locked.has(index) ? "●" : "⌑";
    lockButton.addEventListener("click", () => {
      if (locked.has(index)) locked.delete(index);
      else locked.add(index);
      renderPalette();
    });

    const picker = document.createElement("input");
    picker.className = "swatch-pick";
    picker.type = "color";
    picker.value = color;
    picker.title = "Chỉnh màu";
    picker.setAttribute("aria-label", `Chỉnh màu ${index + 1}`);
    picker.addEventListener("change", () => {
      palette[index] = picker.value.toUpperCase();
      renderPalette();
    });

    const info = document.createElement("div");
    info.className = "tile-info";
    const hexButton = document.createElement("button");
    hexButton.className = "tile-hex";
    hexButton.type = "button";
    hexButton.textContent = color;
    hexButton.title = "Nhấn để sao chép HEX";
    hexButton.addEventListener("click", () => copyText(color, "Đã sao chép " + color));
    const copyButton = document.createElement("button");
    copyButton.className = "tile-copy";
    copyButton.type = "button";
    copyButton.textContent = "⧉";
    copyButton.setAttribute("aria-label", `Sao chép ${color}`);
    copyButton.addEventListener("click", () => copyText(color, "Đã sao chép " + color));
    info.append(hexButton, copyButton);
    swatch.append(lockButton, picker);
    tile.append(swatch, info);
    grid.append(tile);
  });
}

function generatePalette() {
  const next = makePalette();
  palette = next.map((color, index) => locked.has(index) ? palette[index] : color);
  renderPalette();
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2200);
}

async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(message);
  } catch (error) {
    const field = document.createElement("textarea");
    field.value = text;
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.append(field);
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    if (!copied) {
      showToast("Không thể sao chép. Hãy chọn và sao chép thủ công.");
      return;
    }
    showToast(message);
  }
}

function updateFormat(hex) {
  const normalized = hex.toUpperCase();
  $("#colorInput").value = normalized;
  $("#formatSwatch").style.background = normalized;
  $("#hexInput").value = normalized;
  const rgb = hexToRgb(normalized);
  const hsl = rgbToHsl(...rgb);
  $("#rgbValue").textContent = rgb.join(", ");
  $("#hslValue").textContent = `${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%`;
  $("#formatError").textContent = "";
}

function isValidHex(value) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function updateBlend() {
  const ratio = Number($("#blendAmount").value) / 100;
  const first = hexToRgb($("#blendColorA").value);
  const second = hexToRgb($("#blendColorB").value);
  const mixed = first.map((value, index) => Math.round(value * (1 - ratio) + second[index] * ratio));
  const hex = `#${mixed.map((value) => value.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
  $("#blendHex").textContent = hex;
  $("#blendResult").style.background = hex;
  $("#blendPercent").textContent = `${100 - Number($("#blendAmount").value)} / ${$("#blendAmount").value}`;
  const lightness = rgbToHsl(...mixed)[2];
  $("#blendResult").style.color = lightness > 66 ? "#48483f" : "#fff";
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function downloadPaletteImage() {
  const canvas = document.createElement("canvas");
  canvas.width = 1440;
  canvas.height = 900;
  const context = canvas.getContext("2d");
  if (!context) {
    showToast("Không thể tạo ảnh trên trình duyệt này.");
    return;
  }
  context.fillStyle = "#F7F7F4";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#85877F";
  context.font = "700 18px Arial, sans-serif";
  context.letterSpacing = "3px";
  context.fillText("COLORSTUDIO  /  COLOR PALETTE", 100, 105);
  context.fillStyle = "#292B26";
  context.font = "700 54px Arial, sans-serif";
  context.letterSpacing = "0px";
  context.fillText("Bảng màu của bạn", 100, 190);
  context.fillStyle = "#777A72";
  context.font = "24px Arial, sans-serif";
  context.fillText(new Date().toLocaleDateString("vi-VN"), 100, 238);

  const left = 100;
  const top = 300;
  const totalWidth = 1240;
  const gap = 12;
  const tileWidth = (totalWidth - gap * (palette.length - 1)) / palette.length;
  palette.forEach((color, index) => {
    const x = left + index * (tileWidth + gap);
    context.fillStyle = color;
    context.beginPath();
    context.roundRect(x, top, tileWidth, 365, 12);
    context.fill();
    const [red, green, blue] = hexToRgb(color);
    context.fillStyle = "#363831";
    context.font = "700 25px Arial, sans-serif";
    context.fillText(color, x, 720);
    context.fillStyle = "#888A82";
    context.font = "19px Arial, sans-serif";
    context.fillText(`RGB ${red}, ${green}, ${blue}`, x, 756);
  });
  context.fillStyle = "#999B93";
  context.font = "18px Arial, sans-serif";
  context.fillText("Được tạo với ColorStudio", 100, 835);

  canvas.toBlob((blob) => {
    if (!blob) {
      showToast("Không thể xuất ảnh. Vui lòng thử lại.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bang-mau-${new Date().toISOString().slice(0, 10)}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Đã tải ảnh PNG của bảng màu.");
  }, "image/png");
}

function exportPalette(format) {
  const stamp = new Date().toISOString().slice(0, 10);
  const entries = palette.map((color, index) => ({ name: `Màu ${index + 1}`, hex: color }));
  if (format === "png") {
    downloadPaletteImage();
  } else if (format === "css") {
    const content = `:root {\n${entries.map((item, index) => `  --color-${index + 1}: ${item.hex};`).join("\n")}\n}\n`;
    downloadFile(`bang-mau-${stamp}.css`, content, "text/css");
  } else if (format === "json") {
    downloadFile(`bang-mau-${stamp}.json`, JSON.stringify({ name: "Bảng màu mới", colors: entries }, null, 2), "application/json");
  } else {
    downloadFile(`bang-mau-${stamp}.txt`, palette.join("\n") + "\n", "text/plain");
  }
  $("#exportMenu").classList.add("hidden");
}

function setLibraryCount() {
  $("#savedCount").textContent = palettes.length;
  $("#libraryCount").textContent = palettes.length;
  $("#emptyLibrary").classList.toggle("hidden", palettes.length > 0);
}

function renderLibrary() {
  const grid = $("#libraryGrid");
  grid.innerHTML = "";
  palettes.forEach((saved) => {
    const card = document.createElement("article");
    card.className = "saved-card";
    const swatches = document.createElement("div");
    swatches.className = "saved-swatches";
    saved.colors.forEach((color) => {
      const swatch = document.createElement("button");
      swatch.className = "saved-swatch";
      swatch.type = "button";
      swatch.style.background = color;
      swatch.title = `${color} — nhấn để sao chép`;
      swatch.setAttribute("aria-label", `Sao chép ${color}`);
      swatch.addEventListener("click", () => copyText(color, "Đã sao chép " + color));
      swatches.append(swatch);
    });
    const body = document.createElement("div");
    body.className = "saved-card-body";
    const info = document.createElement("div");
    info.style.minWidth = "0";
    const name = document.createElement("span");
    name.className = "saved-name";
    name.textContent = saved.name;
    const date = document.createElement("span");
    date.className = "saved-date";
    date.textContent = new Date(saved.createdAt).toLocaleDateString("vi-VN");
    info.append(name, date);
    const actions = document.createElement("div");
    actions.className = "saved-actions";
    const loadButton = document.createElement("button");
    loadButton.className = "icon-button";
    loadButton.type = "button";
    loadButton.textContent = "Dùng lại";
    loadButton.addEventListener("click", () => {
      palette = [...saved.colors];
      locked.clear();
      renderPalette();
      window.location.hash = "studio";
      showToast("Đã mở bộ màu " + saved.name);
    });
    const deleteButton = document.createElement("button");
    deleteButton.className = "icon-button delete";
    deleteButton.type = "button";
    deleteButton.textContent = "Xóa";
    deleteButton.setAttribute("aria-label", `Xóa bộ màu ${saved.name}`);
    deleteButton.addEventListener("click", () => deletePalette(saved.id));
    actions.append(loadButton, deleteButton);
    body.append(info, actions);
    card.append(swatches, body);
    grid.append(card);
  });
  setLibraryCount();
}

async function loadPalettes() {
  const response = await fetch("/api/palettes");
  if (!response.ok) throw new Error("Không thể tải kho bộ màu.");
  palettes = await response.json();
  renderLibrary();
}

async function savePalette() {
  const requestedName = window.prompt("Đặt tên cho bộ màu này:", `Bộ màu ${new Date().toLocaleDateString("vi-VN")}`);
  if (requestedName === null) return;
  const name = requestedName.trim();
  if (!name) {
    showToast("Tên bộ màu không được để trống.");
    return;
  }
  try {
    const response = await fetch("/api/palettes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, colors: palette }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Không thể lưu bộ màu.");
    palettes.unshift(result);
    renderLibrary();
    showToast("Đã lưu bộ màu vào kho.");
  } catch (error) {
    showToast(error.message || "Không thể kết nối máy chủ để lưu bộ màu.");
  }
}

async function deletePalette(id) {
  try {
    const response = await fetch(`/api/palettes/${id}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Không thể xóa bộ màu.");
    palettes = palettes.filter((item) => item.id !== id);
    renderLibrary();
    showToast("Đã xóa bộ màu.");
  } catch (error) {
    showToast(error.message || "Không thể kết nối máy chủ để xóa bộ màu.");
  }
}

function stopScreenCapture() {
  if (captureStream) captureStream.getTracks().forEach((track) => track.stop());
  captureStream = null;
  $("#screenCaptureArea").classList.add("hidden");
  $("#screenVideo").srcObject = null;
}

async function startScreenCapture() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    showToast("Trình duyệt chưa hỗ trợ chia sẻ màn hình. Hãy thử Chrome hoặc Edge mới.");
    return;
  }
  try {
    captureStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const video = $("#screenVideo");
    video.srcObject = captureStream;
    $("#screenCaptureArea").classList.remove("hidden");
    captureStream.getVideoTracks()[0].addEventListener("ended", stopScreenCapture, { once: true });
    video.addEventListener("click", sampleScreenColor);
  } catch (error) {
    if (error.name === "NotAllowedError") showToast("Bạn đã hủy hoặc chưa cho phép chia sẻ màn hình.");
    else showToast("Không thể lấy hình ảnh màn hình. Vui lòng thử lại.");
  }
}

function sampleScreenColor(event) {
  const video = $("#screenVideo");
  if (!video.videoWidth || !video.videoHeight) {
    showToast("Màn hình chưa sẵn sàng. Vui lòng thử lại sau giây lát.");
    return;
  }
  const bounds = video.getBoundingClientRect();
  const x = Math.min(video.videoWidth - 1, Math.floor((event.clientX - bounds.left) / bounds.width * video.videoWidth));
  const y = Math.min(video.videoHeight - 1, Math.floor((event.clientY - bounds.top) / bounds.height * video.videoHeight));
  const canvas = $("#screenCanvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(video, 0, 0);
  const [red, green, blue] = context.getImageData(x, y, 1, 1).data;
  const hex = `#${[red, green, blue].map((value) => value.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
  updateFormat(hex);
  showToast(`Đã lấy mẫu màu ${hex}`);
}

$("#generateBtn").addEventListener("click", generatePalette);
$("#harmony").addEventListener("change", generatePalette);
$("#savePaletteBtn").addEventListener("click", savePalette);
$("#exportBtn").addEventListener("click", () => $("#exportMenu").classList.toggle("hidden"));
$("#exportMenu").addEventListener("click", (event) => {
  const format = event.target.dataset.export;
  if (format) exportPalette(format);
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".export-wrap")) $("#exportMenu").classList.add("hidden");
});
document.addEventListener("keydown", (event) => {
  if (event.code === "Space" && !["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    generatePalette();
  }
});
$("#colorInput").addEventListener("input", (event) => updateFormat(event.target.value));
$("#hexInput").addEventListener("input", (event) => {
  const value = event.target.value.trim();
  if (isValidHex(value)) updateFormat(value);
  else $("#formatError").textContent = "Nhập mã HEX gồm # và 6 ký tự.";
});
$("#hexInput").addEventListener("change", (event) => {
  const value = event.target.value.trim();
  if (!isValidHex(value)) updateFormat($("#colorInput").value);
});
document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.dataset.copy;
    const value = key === "hex" ? $("#hexInput").value : key === "rgb" ? `rgb(${$("#rgbValue").textContent})` : `hsl(${$("#hslValue").textContent})`;
    copyText(value, `Đã sao chép ${key.toUpperCase()}`);
  });
});
["blendColorA", "blendColorB", "blendAmount"].forEach((id) => $(`#${id}`).addEventListener("input", updateBlend));
$("#blendResult").addEventListener("click", () => copyText($("#blendHex").textContent, "Đã sao chép màu pha trộn."));
$("#screenPickBtn").addEventListener("click", startScreenCapture);
$("#stopCaptureBtn").addEventListener("click", stopScreenCapture);

renderPalette();
updateFormat($("#colorInput").value);
updateBlend();
loadPalettes().catch((error) => {
  $("#emptyLibrary").querySelector("p").textContent = error.message;
  showToast(error.message);
});
