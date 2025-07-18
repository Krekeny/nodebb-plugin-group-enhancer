"use strict";

// Configuration for logo uploads
const UPLOAD_CONFIG = {
  maxFileSize: 0.5 * 1024 * 1024,

  allowedTypes: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
  ],

  allowedExtensions: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"],

  // Upload folder in NodeBB
  uploadFolder: "",
};

const log = (...a) => console.log("[Group‑Enhancer]", ...a);

let csrfToken = null;

// Validate uploaded file against configuration
function validateFile(file) {
  // Check file size
  if (file.size > UPLOAD_CONFIG.maxFileSize) {
    const maxSizeMB = UPLOAD_CONFIG.maxFileSize / (1024 * 1024);
    throw new Error(`File size exceeds maximum allowed size of ${maxSizeMB}MB`);
  }

  // Check MIME type
  if (!UPLOAD_CONFIG.allowedTypes.includes(file.type)) {
    throw new Error(
      `File type "${
        file.type
      }" is not allowed. Allowed types: ${UPLOAD_CONFIG.allowedTypes.join(
        ", "
      )}`
    );
  }

  // Check file extension
  const fileName = file.name.toLowerCase();
  const hasValidExtension = UPLOAD_CONFIG.allowedExtensions.some((ext) =>
    fileName.endsWith(ext)
  );

  if (!hasValidExtension) {
    throw new Error(
      `File extension not allowed. Allowed extensions: ${UPLOAD_CONFIG.allowedExtensions.join(
        ", "
      )}`
    );
  }

  return true;
}

// Fetch CSRF token once and cache it
async function getCSRFToken() {
  if (csrfToken) return csrfToken;
  try {
    const cfg = await $.getJSON("/api/config");
    csrfToken = cfg.csrf_token;
    return csrfToken;
  } catch (err) {
    console.error("[Group‑Enhancer] Could not fetch CSRF token", err);
    return null;
  }
}

async function uploadFile(file, groupSlug) {
  // Validate file before upload
  try {
    validateFile(file);
  } catch (error) {
    throw new Error(`File validation failed: ${error.message}`);
  }

  const token = await getCSRFToken();
  if (!token) {
    throw new Error("CSRF token not available");
  }

  // Generate custom filename: group-slug_logo.extension
  const fileExtension = file.name.substring(file.name.lastIndexOf("."));
  const customFileName = `${groupSlug}_logo${fileExtension}`;

  // Create a new file object with the custom name
  const renamedFile = new File([file], customFileName, { type: file.type });

  // Use the correct NodeBB upload API format
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("files", renamedFile);
    formData.append(
      "params",
      JSON.stringify({
        folder: UPLOAD_CONFIG.uploadFolder,
      })
    );

    fetch("/api/admin/upload/file", {
      method: "POST",
      headers: {
        "x-csrf-token": token,
        // Don't set Content-Type - let browser set it with boundary
      },
      body: formData,
    })
      .then((response) => {
        if (!response.ok) {
          return response.text().then((text) => {
            throw new Error(
              `Upload failed: ${response.status} ${response.statusText}`
            );
          });
        }
        return response.json();
      })
      .then((data) => {
        log("Upload success response:", data);

        // Handle the NodeBB upload response format: [{"url":"/path/to/file.jpg"}]
        if (Array.isArray(data) && data.length > 0 && data[0].url) {
          resolve(data[0].url);
        } else if (data.url) {
          resolve(data.url);
        } else if (data.files && data.files.length > 0) {
          resolve(data.files[0].url || data.files[0]);
        } else if (typeof data === "string") {
          resolve(data);
        } else {
          log("Unexpected upload response format:", data);
          reject(new Error("Upload response missing URL"));
        }
      })
      .catch((error) => {
        log("Upload error:", error);
        reject(error);
      });
  });
}

async function putGroup(slug, payload) {
  const token = await getCSRFToken();
  if (!token) {
    throw new Error("CSRF token not available");
  }

  const res = await fetch(
    `/api/v3/plugins/group-enhancer/groups/${encodeURIComponent(slug)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": token,
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const error = errBody.error || res.statusText || "Unknown error";
    throw new Error(error);
  }

  return res.json();
}

function isEditPage(url) {
  return url.startsWith("admin/manage/groups/") && !url.endsWith("/new");
}

function inject() {
  const $form = $(".group-settings-form");
  if (!$form.length || $("#change-group-extradesc").length) return;

  log("Injecting extra inputs…");
  $form.find("#change-group-desc").closest(".mb-3").after(`
    <div class="mb-3">
      <label class="form-label" for="change-group-extradesc">Long Description</label>
      <textarea id="change-group-extradesc" name="extraDesc" class="form-control" rows="4" maxlength="2048"></textarea>
    </div>
    <div class="mb-3">
      <label class="form-label" for="change-group-logo">Logo image</label>
      <input id="change-group-logo" name="logo" class="form-control" type="file" accept="${UPLOAD_CONFIG.allowedExtensions.join(
        ","
      )}">
      <input type="hidden" id="current-group-logo" name="currentLogo" value="">
      <p class="form-text">Current: <div id="current-logo-display"></div></p>
      <p class="form-text text-muted">
        Allowed formats: ${UPLOAD_CONFIG.allowedExtensions.join(", ")} | 
        Max size: ${UPLOAD_CONFIG.maxFileSize / (1024 * 1024)}MB
      </p>
    </div>
    <div class="mb-3">
      <label class="form-label" for="change-group-url">Website</label>
      <input id="change-group-url" name="url" class="form-control" type="url">
    </div>
    <div class="mb-3">
      <label class="form-label" for="change-group-address">Address</label>
      <input id="change-group-address" name="address" class="form-control" type="text">
    </div>
  `);

  const g = ajaxify?.data?.group || ajaxify?.data || {};
  $("#change-group-extradesc").val(g.extraDesc || "");
  $("#change-group-url").val(g.url || "");
  $("#change-group-address").val(g.address || "");

  // Handle current logo
  const currentLogo = g.logo || "";
  $("#current-group-logo").val(currentLogo);
  if (currentLogo) {
    $("#current-logo-display").html(
      `<img src="${currentLogo}" alt="Current logo" style="max-height: 40px; max-width: 100px;">`
    );
  } else {
    $("#current-logo-display").text("No logo set");
  }
}

function showAlertSuccess(message) {
  if (typeof app !== "undefined" && app.alert) {
    app.alert({
      type: "success",
      alert_id: "group-enhancer-success",
      title: "Success",
      message,
    });
  } else {
    alert(message);
  }
}

function showAlertError(message) {
  if (typeof app !== "undefined" && app.alert) {
    app.alert({
      type: "danger",
      alert_id: "group-enhancer-error",
      title: "Error",
      message,
    });
  } else {
    alert(`Error: ${message}`);
  }
}

function wireSaveButton(data = {}) {
  log("Wiring save button...", data);

  const $btn = $("#save");
  if (!$btn.length) {
    console.warn("[Group‑Enhancer] Save button not found");
    return;
  }

  const slug = data?.group?.slug || ajaxify?.data?.group?.slug;
  if (!slug) {
    console.warn("[Group‑Enhancer] Missing slug. ajaxify.data:", ajaxify?.data);
    showAlertError("Missing group slug!");
    return;
  }

  log("Found save button. Using slug:", slug);

  $btn.off("click.groupEnhancer").on("click.groupEnhancer", async (e) => {
    log("Save button clicked");

    e.preventDefault();
    e.stopImmediatePropagation();

    // Handle file input for logo
    const logoFile = $("#change-group-logo")[0]?.files?.[0];
    let logoUrl = $("#current-group-logo").val(); // Start with current logo

    if (logoFile) {
      try {
        log("Uploading logo file...");
        logoUrl = await uploadFile(logoFile, slug);
        log("Logo uploaded successfully:", logoUrl);
      } catch (err) {
        console.error("[Group‑Enhancer] Error uploading logo file:", err);
        showAlertError(`Error uploading logo: ${err.message}`);
        return;
      }
    }

    const payload = {
      // core fields
      name: $("#change-group-name").val()?.trim(),
      description: $("#change-group-desc").val()?.trim(),
      hidden: $("#group-hidden").is(":checked"),
      private: $("#group-private").is(":checked"),
      disableJoinRequests: $("#group-disableJoinRequests").is(":checked"),
      // extra fields
      extraDesc: $("#change-group-extradesc").val()?.trim(),
      logo: logoUrl,
      url: $("#change-group-url").val()?.trim(),
      address: $("#change-group-address").val()?.trim(),
    };

    log("Payload to save:", payload);

    try {
      await putGroup(slug, payload);
      log("Save success, redirecting...");
      showAlertSuccess("Group saved successfully!");
      ajaxify.go(`admin/manage/groups/${encodeURIComponent(slug)}`);
    } catch (err) {
      console.error("[Group‑Enhancer] Save error", err);
      showAlertError(err.message || "Save failed");
    }
  });
}

function onPageLoad(_ev, data = {}) {
  const url = data.url || window.location.pathname.replace(/^\/+/, "");
  if (!isEditPage(url)) {
    log("Not on group edit page:", url);
    return;
  }

  log("On group edit page:", url);

  const wait = setInterval(() => {
    if (!$(".group-settings-form").length) return;
    clearInterval(wait);
    inject();
    wireSaveButton(data);
  }, 50);
}

onPageLoad();
$(window).on("action:ajaxify.end", onPageLoad);

log("Admin script loaded");
