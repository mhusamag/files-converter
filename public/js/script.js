// $(document).ready(function () {
// Define Allowed Files
const IMAGE_FORMATS = [
  "jpg",
  "png",
  "gif",
  "webp",
  "bmp",
  "tiff",
  "jpeg",
  "jfif",
  "pjpeg",
  "pjp",
];
const AUDIO_FORMATS = ["mp3", "wav", "ogg", "aac", "m4a", "flac", "wma", "m4a"];
const VIDEO_FORMATS = ["mp4", "webm", "mov", "avi", "mkv", "wmv", "flv"];

// State variables
let ffmpeg = null;
let activeTab = "all-files";
let resultUrl = null;
let selectedFiles = [];

// Load FFmpeg dynamically
async function loadFFmpegLibraries() {
  try {
    $(".loading-container").removeClass("hidden");
    // Load the FFmpeg libraries dynamically
    const ffmpegScript = document.createElement("script");
    ffmpegScript.src = "js/ffmpeg.min.js";
    document.body.appendChild(ffmpegScript);

    // Wait for the script to load
    await new Promise((resolve, reject) => {
      ffmpegScript.onload = resolve;
      ffmpegScript.onerror = reject;
    });

    // Now load the FFmpeg core
    const { createFFmpeg, fetchFile } = FFmpeg;
    window.fetchFile = fetchFile; // Make fetchFile globally available

    // Create FFmpeg instance
    ffmpeg = createFFmpeg({
      log: true,
      progress: ({ ratio, time }) => {
        // This is the global progress handler, we'll handle individual progress in the conversion loop
      },
      corePath:
        "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.10.0/dist/ffmpeg-core.js",
    });
    // Load FFmpeg
    await ffmpeg.load();

    // Show main content once FFmpeg is loaded
    $(".loading-container").addClass("hidden");
    // $("#main-content").removeClass("hidden");
    // $(".tabs .tab").first().click();

    return true;
  } catch (err) {
    showError(
      "Failed to load FFmpeg. Please try again or use a different browser."
    );
    console.error("FFmpeg loading error:", err);
    return false;
  }
}

// Tab switching
$(".tab").click(function () {
  // check hasClass active then return
  if ($(this).hasClass("active")) return;
  $(".tab").removeClass("active");
  $(this).addClass("active");

  activeTab = $(this).data("tab");
  updateFormatInfo();

  // Reset if we change tabs
  if (selectedFiles.length) {
    resetConverter();
  }
});

// Update format info based on active tab
function updateFormatInfo() {
  let formats;
  switch (activeTab) {
    case "all-files":
      formats = "Image, Audio, Video";
      $("#file-input").attr("accept", "image/*,audio/*,video/*");
      break;
    case "image":
      formats = IMAGE_FORMATS.join(", ");
      $("#file-input").attr("accept", "image/*");
      break;
    case "audio":
      formats = AUDIO_FORMATS.join(", ");
      $("#file-input").attr("accept", "audio/*");
      break;
    case "video":
      formats = VIDEO_FORMATS.join(", ");
      $("#file-input").attr("accept", "video/*");
      break;
  }

  $("#format-info").text(`Allowed Files: ${formats}`);
}

// Show error message
function showError(message) {
  $("#error-message").text(message);
  $("#error-alert").removeClass("hidden");
}

// Hide error message
function hideError() {
  $("#error-alert").addClass("hidden");
}

// Handle file selection
$("#file-input").change(function (e) {
  if (e.target.files.length > 0) {
    processSelectedFiles(e.target.files);
  }
});

// Handle drag and drop
$("#upload-area").on("dragenter dragover", function (e) {
  e.preventDefault();
  e.stopPropagation();
  $(this).addClass("drag-active");
});

$("#upload-area").on("dragleave", function (e) {
  e.preventDefault();
  e.stopPropagation();
  $(this).removeClass("drag-active");
});

$("#upload-area").on("drop", function (e) {
  e.preventDefault();
  e.stopPropagation();
  $(this).removeClass("drag-active");

  if (e.originalEvent.dataTransfer.files.length > 0) {
    processSelectedFiles(e.originalEvent.dataTransfer.files);
  }
});

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes < 1024) {
    return bytes + " B"; // Bytes
  } else if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(2) + " KB"; // Kilobytes
  } else if (bytes < 1024 * 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(2) + " MB"; // Megabytes
  } else {
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB"; // Gigabytes
  }
}

function getFileFormats(selectFileExt) {
  let validFormats,
    fileExt = selectFileExt;
  if (IMAGE_FORMATS.includes(fileExt)) {
    validFormats = IMAGE_FORMATS.filter((format) => format !== fileExt);
  } else if (AUDIO_FORMATS.includes(fileExt)) {
    validFormats = AUDIO_FORMATS.filter((format) => format !== fileExt);
  } else if (VIDEO_FORMATS.includes(fileExt)) {
    validFormats = VIDEO_FORMATS.filter((format) => format !== fileExt);
  }

  return validFormats;
}

// Process selected files
function processSelectedFiles(files, isUploadMore = false) {
  // If no files, return early
  hideError();

  // Clear previous selections only if not uploading more files
  if (!isUploadMore) {
    $("#file-info-container .file-info").empty();
    selectedFiles = [];
  }

  // Group files by type (image, audio, video)
  const filesByType = {
    image: [],
    audio: [],
    video: [],
    unsupported: [],
  };

  // Filter out duplicates and get new files
  const newFiles = Array.from(files).filter(
    (file) =>
      !isUploadMore ||
      !selectedFiles.some((f) => f.name === file.name && f.size === file.size)
  );

  // Categorize new files
  newFiles.forEach((file) => {
    const fileExt = file.name.split(".").pop().toLowerCase();
    if (IMAGE_FORMATS.includes(fileExt)) filesByType.image.push(file);
    else if (AUDIO_FORMATS.includes(fileExt)) filesByType.audio.push(file);
    else if (VIDEO_FORMATS.includes(fileExt)) filesByType.video.push(file);
    else filesByType.unsupported.push(file);
  });

  // Handle unsupported files
  if (filesByType.unsupported.length > 0) {
    showError(`${filesByType.unsupported.length} unsupported file(s).`);
    if (
      filesByType.image.length +
        filesByType.audio.length +
        filesByType.video.length ===
      0
    ) {
      return;
    }
  }

  // Determine active tab if not uploading more
  if (!isUploadMore) {
    const counts = {
      image: filesByType.image.length,
      audio: filesByType.audio.length,
      video: filesByType.video.length,
    };
    const maxCount = Math.max(...Object.values(counts));

    if (activeTab !== "all-files") {
      activeTab =
        Object.keys(counts).find((key) => counts[key] === maxCount) || "image";

      $(".tab").removeClass("active");
      $(`.tab[data-tab="${activeTab}"]`).addClass("active");
    }
    updateFormatInfo();
  }

  // Get supported files
  const supportedFiles = [
    ...filesByType.image,
    ...filesByType.audio,
    ...filesByType.video,
  ];

  // Process files in reverse order for prepend but maintain original order in array
  const $parent = $("#file-info-container");
  [...supportedFiles].reverse().forEach((file) => {
    const fileExt = file.name.split(".").pop().toLowerCase();
    const fileSize = formatFileSize(file.size);
    const validFormats = getFileFormats(fileExt);
    const selectId = `${Math.random().toString(36).substr(2, 9)}`;

    // Add file metadata
    file.originalExtension = fileExt;
    file.selectedFormat = validFormats[0];
    file.fileId = selectId;

    // Prepend to UI
    $parent.find(".file-info").prepend(`
      <div class="file" data-id="${selectId}" data-filename="${file.name}">
        <div class="info">
            <div class="d-flex flex-column">
              <p class="file-name">${file.name}</p>
              <div class="file-ext-size">
                <span class="extension">${fileExt}</span>
                <span class="dot">.</span>
                <p class="file-size">${fileSize}</p>
              </div>
            </div>
            <div class="select-convert-format">
              <div class="d-flex align-items-center">
                <span class="label me-3">to</span>
                <select id="${selectId}" class="format-select">
                  ${validFormats
                    .map(
                      (format) =>
                        `<option value="${format}">${format.toUpperCase()}</option>`
                    )
                    .join("")}
                </select>
              </div>
            </div>
        </div>
        
        <span class="remove-selected-file cp">
          <img src="./images/close.svg" alt="" class="img-fluid" />
        </span>
      </div>
    `);

    // Add event handler
    $(`#${selectId}`).change(function () {
      const newFormat = $(this).val();
      const fileObj = selectedFiles.find((f) => f.fileId === selectId);
      if (fileObj) {
        fileObj.selectedFormat = newFormat;
        const isSame = fileObj.originalExtension === newFormat;
        $(this).toggleClass("same-format", isSame);
        $("#convert-btn").prop(
          "disabled",
          !selectedFiles.some((f) => f.originalExtension !== f.selectedFormat)
        );
      }
    });
  });

  // Add new files to selectedFiles array (maintaining logical order)
  selectedFiles = isUploadMore
    ? [...supportedFiles, ...selectedFiles] // New files first in array when uploading more
    : [...selectedFiles, ...supportedFiles]; // Existing behavior for initial upload

  updateFileInput();
  $("#upload-area").addClass("hidden");
  $parent.removeClass("hidden");
  $(".file-action-btn").removeClass("hidden");
}

// Upload more files handler
$(document).on("change", ".upload-more-files", function (e) {
  if (e.target.files.length > 0) {
    processSelectedFiles(e.target.files, true);
    $(this).val(""); // Reset input
  }
});

// Global format change handler (optional fallback)
$(document).on("change", ".format-select", function () {
  const newFormat = $(this).val();
  const filename = $(this).closest(".file").data("filename");
  const file = selectedFiles.find((f) => f.name === filename);

  if (file) {
    file.selectedFormat = newFormat;

    // Check if this would be same conversion
    if (file.originalExtension === newFormat) {
      $(this).addClass("same-format");
    } else {
      $(this).removeClass("same-format");
    }

    // Enable convert button if at least one file has a valid conversion
    const hasValidConversion = selectedFiles.some(
      (f) => f.originalExtension !== f.selectedFormat
    );
    $("#convert-btn").prop("disabled", !hasValidConversion);
  }
});

// Upload more files and set to selectedFiles
$(document).on("change", ".upload-more-files", function (e) {
  if (e.target.files.length > 0) {
    processSelectedFiles(e.target.files, true);
  }
});

// Update file input with current selection
function updateFileInput() {
  const dataTransfer = new DataTransfer();
  selectedFiles.forEach((file) => dataTransfer.items.add(file));
  document.getElementById("file-input").files = dataTransfer.files;
}

// Handle file removal
$(document).on("click", ".remove-selected-file", function () {
  const $fileElement = $(this).closest(".file");
  const filename = $fileElement.data("filename");
  const fileId = $fileElement.data("id");

  // Remove from DOM with animation
  $fileElement.fadeOut(200, function () {
    $(this).remove();

    // Remove from selectedFiles array
    selectedFiles = selectedFiles.filter((file) => file.fileId !== fileId);

    // Update the file input
    updateFileInput();

    // Check if any files remain
    if (selectedFiles.length === 0) {
      showUploadArea();
    } else {
      reevaluateActiveTab();
      checkValidConversions();
    }
  });
});

// Helper function to show upload area
function showUploadArea() {
  $("#upload-area").removeClass("hidden");
  $("#file-info-container").addClass("hidden");
  $(".file-action-btn").addClass("hidden");
  $(".alert").addClass("hidden");
}

// Helper function to reevaluate active tab
function reevaluateActiveTab() {
  const typeCounts = selectedFiles.reduce(
    (counts, file) => {
      const ext = file.name.split(".").pop().toLowerCase();
      if (IMAGE_FORMATS.includes(ext)) counts.image++;
      else if (AUDIO_FORMATS.includes(ext)) counts.audio++;
      else if (VIDEO_FORMATS.includes(ext)) counts.video++;
      return counts;
    },
    { image: 0, audio: 0, video: 0 }
  );

  const maxCount = Math.max(...Object.values(typeCounts));
  const newTab =
    Object.keys(typeCounts).find((key) => typeCounts[key] === maxCount) ||
    activeTab;

  if (newTab !== activeTab) {
    activeTab = newTab;
    $(".tab").removeClass("active");
    $(`.tab[data-tab="${activeTab}"]`).addClass("active");
    updateFormatInfo();
  }
}

// Helper function to check valid conversions
function checkValidConversions() {
  const hasValidConversion = selectedFiles.some(
    (f) => f.originalExtension !== f.selectedFormat
  );
  $("#convert-btn").prop("disabled", !hasValidConversion);
}

// Reset converter
function resetConverter() {
  selectedFiles = [];
  $("#file-input").val("");
  $("#file-info-container").addClass("hidden");
  $("#upload-area").removeClass("hidden");
  $(".file-action-btn").addClass("hidden");
  $(".progress-container").addClass("hidden");
  $("#convert-btn").prop("disabled", false).removeClass("hidden");
  $(".add-more-files").removeClass("hidden");
  $(".convert-more-files").addClass("hidden");
  $(".tab").removeClass("disabled");

  // Revoke previous URL if exists
  if (resultUrl) {
    URL.revokeObjectURL(resultUrl);
    resultUrl = null;
  }

  currentConversion = null;
  $("#file-info-container .heading strong").text("Uploaded Files");
}

// Change file button
$(".convert-more-files").click(function () {
  resetConverter();
});

let currentConversion = null;
let outputFormat = "";
let isConversionCancelled = false;
let currentFFmpegProcess = null; // Changed from currentFFmpegCommand

// Cancel button handler
$(".cancel-conversation").click(function () {
  isConversionCancelled = true;

  if (currentFFmpegProcess) {
    try {
      // FFmpeg.js doesn't have terminate(), but we can abort the process
      ffmpeg.setLogger(() => {}); // Stop logging
      ffmpeg.exit(); // This will cause the current process to reject
    } catch (e) {
      console.error("Error cancelling conversion:", e);
    }
  }

  // Reset UI
  $(".cancel-conversation").addClass("hidden");
  $("#convert-btn").removeClass("hidden").prop("disabled", false);
  $(".tab").removeClass("disabled");

  // remove the progress handler and set select box
  $(".file-info .file").each(function () {
    if ($(this).hasClass("converted")) return;
    let $this = $(this),
      id = $this.data("id"),
      validFormats = getFileFormats($this.data("filename").split(".").pop());

    $this.find(".progress-container").remove();
    $this.find(".select-convert-format").html(`
      <div class="d-flex align-items-center">
        <span class="label me-3">to</span>
        <select id="${id}" class="format-select">
          ${validFormats
            .map(
              (format) =>
                `<option value="${format}">${format.toUpperCase()}</option>`
            )
            .join("")}
        </select>
      </div>
    `);
  });

  currentConversion = null;
  currentFFmpegProcess = null;

  // finished files according remove object in selectedFiles array
  selectedFiles = selectedFiles.filter((file) => {
    // Find the corresponding file element
    const $fileElement = $(`.file[data-filename="${file.name}"]`);

    // Keep the file only if its element doesn't have 'converted' class
    return !$fileElement.hasClass("converted");
  });
});

$("#convert-btn").click(async function () {
  // Load FFmpeg on page load
  await loadFFmpegLibraries();

  // Check same conversion
  if (currentConversion) {
    alert("Same conversion! Please select a different format.");
    return;
  }

  if (!selectedFiles.length || !ffmpeg) {
    if (!ffmpeg) {
      showError("FFmpeg is not loaded yet. Please wait or refresh the page.");
    }
    return;
  }

  // Reset cancellation flag
  isConversionCancelled = false;

  // Show cancel button and hide convert button
  $(".cancel-conversation").removeClass("hidden");

  // Show progress and disable controls+
  $("#convert-btn").prop("disabled", true);
  $(".upload-more-files").prop("disabled", true);
  $(".file .remove-selected-file").css("pointer-events", "none");
  $(".tab").addClass("disabled");
  hideError();

  $(".file-info .file:not(.converted)").find(".select-convert-format").html(`
    <span class="badge bg-warning">Uploading</span>
  `);

  // Process each file sequentially
  for (const selectedFile of selectedFiles) {
    if (isConversionCancelled) break;

    const $fileElement = $(`.file[data-id="${selectedFile.fileId}"]`);

    try {
      // Create individual progress container for this file
      $fileElement.find(".select-convert-format").html(`
        <div class="progress-container">
          <p class="progress-text">Converting... 0%</p>
          <div class="progress-bar-container">
            <div class="progress-bar" style="width: 0%"></div>
          </div>
        </div>
      `);

      outputFormat = selectedFile.selectedFormat;
      const selectedFileExt = selectedFile.name.split(".").pop();
      const inputFileName = `input_${Date.now()}.${selectedFileExt}`;
      const outputFileName = `output_${Date.now()}.${outputFormat}`;

      // Write the file to FFmpeg's file system
      ffmpeg.FS(
        "writeFile",
        inputFileName,
        await window.fetchFile(selectedFile)
      );

      // Create a robust progress handler for this specific file
      let lastValidPercent = 0;
      const progressHandler = ({ ratio, time }) => {
        if (isConversionCancelled) return;

        let percent;
        if (typeof ratio === "number" && !isNaN(ratio)) {
          percent = Math.round(ratio * 100);
          lastValidPercent = percent;
        } else if (typeof time === "number" && time > 0) {
          percent = Math.min(lastValidPercent + 10, 99);
          lastValidPercent = percent;
        } else {
          percent = lastValidPercent;
        }

        percent = Math.max(0, Math.min(percent, 99));
        $fileElement.find(".progress-text").text(`Converting... ${percent}%`);
        $fileElement.find(".progress-bar").css("width", `${percent}%`);
      };

      // Set the progress handler for this conversion
      ffmpeg.setProgress(progressHandler);

      // if check all files then selected file format according get active tab
      if (activeTab === "all-files") {
        if (IMAGE_FORMATS.includes(selectedFileExt)) {
          activeTab = "image";
        } else if (AUDIO_FORMATS.includes(selectedFileExt)) {
          activeTab = "audio";
        } else if (VIDEO_FORMATS.includes(selectedFileExt)) {
          activeTab = "video";
        }
      }

      // Run FFmpeg command based on file type
      if (activeTab === "image") {
        if (activeTab === "image" && outputFormat === "tiff") {
          currentFFmpegCommand = ffmpeg.run(
            "-i",
            inputFileName,
            "-pix_fmt",
            "rgb24",
            "-compression_algo",
            "deflate",
            outputFileName
          );
        } else if (outputFormat === "jfif") {
          currentFFmpegCommand = ffmpeg.run(
            "-i",
            inputFileName,
            "-q:v",
            "2",
            "-f",
            "mjpeg",
            outputFileName
          );
        } else if (outputFormat === "pjpeg") {
          currentFFmpegCommand = ffmpeg.run(
            "-i",
            inputFileName,
            "-q:v",
            "2",
            "-c:v",
            "mjpeg",
            "-pix_fmt",
            "yuvj420p",
            "-f",
            "mjpeg",
            outputFileName
          );
        } else if (outputFormat === "pjp") {
          currentFFmpegCommand = ffmpeg.run(
            "-i",
            inputFileName,
            "-q:v",
            "2",
            "-c:v",
            "mjpeg",
            "-pix_fmt",
            "yuvj420p",
            "-f",
            "mjpeg",
            outputFileName
          );
        } else {
          currentFFmpegCommand = ffmpeg.run(
            "-i",
            inputFileName,
            outputFileName
          );
        }
      } else if (activeTab === "audio") {
        let codec = "libmp3lame";
        if (outputFormat === "wav") {
          codec = "pcm_s16le";
        } else if (outputFormat === "ogg") {
          codec = "libvorbis";
        } else if (outputFormat === "aac") {
          codec = "aac";
        } else if (outputFormat === "m4a") {
          codec = "aac";
        } else if (outputFormat === "flac") {
          codec = "flac";
        } else if (outputFormat === "wma") {
          codec = "wmav2";
        } else if (outputFormat === "M4A") {
          codec = "aac";
        }

        currentFFmpegCommand = ffmpeg.run(
          "-i",
          inputFileName,
          "-c:a",
          codec,
          "-b:a",
          "192k",
          outputFileName
        );
      } else if (activeTab === "video") {
        if (outputFormat === "avi") {
          currentFFmpegCommand = ffmpeg.run(
            "-i",
            inputFileName,
            "-c:v",
            "libx264",
            "-crf",
            "23",
            "-preset",
            "ultrafast",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            outputFileName
          );
        } else if (outputFormat === "webm") {
          currentFFmpegCommand = ffmpeg.run(
            "-i",
            inputFileName,
            "-c:v",
            "libvpx",
            "-crf",
            "10",
            "-b:v",
            "1M",
            "-c:a",
            "libvorbis",
            outputFileName
          );
        } else if (selectedFileExt === "webm") {
          currentFFmpegCommand = ffmpeg.run(
            "-i",
            inputFileName,
            "-c:v",
            "libx264",
            "-crf",
            "23",
            "-preset",
            "fast",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            outputFileName
          );
        } else if (outputFormat === "wmv") {
          currentFFmpegCommand = ffmpeg.run(
            "-i",
            inputFileName,
            "-c:v",
            "msmpeg4v3",
            "-b:v",
            "2000k",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "wmav2",
            "-b:a",
            "192k",
            "-ac",
            "2",
            outputFileName
          );
        } else {
          currentFFmpegCommand = ffmpeg.run(
            "-i",
            inputFileName,
            "-c",
            "copy",
            outputFileName
          );
        }
      }

      // Wait for conversion to complete
      await currentFFmpegCommand;

      if (isConversionCancelled) {
        // Clean up if cancelled
        ffmpeg.FS("unlink", inputFileName);
        if (ffmpeg.FS("readdir", "/").includes(outputFileName)) {
          ffmpeg.FS("unlink", outputFileName);
        }
        break;
      }

      // Read the result
      const data = ffmpeg.FS("readFile", outputFileName);
      const blob = new Blob([data.buffer], {
        type: getMimeType(outputFormat),
      });
      const resultUrl = URL.createObjectURL(blob);
      const outputName = selectedFile.name.split(".")[0] + "." + outputFormat;

      // Create result item
      $fileElement.append(`
        <div class="download">
          <a href="${resultUrl}" download="${outputName}" class="download-output-file">
          <button class="cssbuttons-io-button">
            Download
            <div class="icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="800px" height="800px" viewBox="0 0 24 24" fill="none">
<path d="M12.5535 16.5061C12.4114 16.6615 12.2106 16.75 12 16.75C11.7894 16.75 11.5886 16.6615 11.4465 16.5061L7.44648 12.1311C7.16698 11.8254 7.18822 11.351 7.49392 11.0715C7.79963 10.792 8.27402 10.8132 8.55352 11.1189L11.25 14.0682V3C11.25 2.58579 11.5858 2.25 12 2.25C12.4142 2.25 12.75 2.58579 12.75 3V14.0682L15.4465 11.1189C15.726 10.8132 16.2004 10.792 16.5061 11.0715C16.8118 11.351 16.833 11.8254 16.5535 12.1311L12.5535 16.5061Z" fill="#1C274C"/>
<path d="M3.75 15C3.75 14.5858 3.41422 14.25 3 14.25C2.58579 14.25 2.25 14.5858 2.25 15V15.0549C2.24998 16.4225 2.24996 17.5248 2.36652 18.3918C2.48754 19.2919 2.74643 20.0497 3.34835 20.6516C3.95027 21.2536 4.70814 21.5125 5.60825 21.6335C6.47522 21.75 7.57754 21.75 8.94513 21.75H15.0549C16.4225 21.75 17.5248 21.75 18.3918 21.6335C19.2919 21.5125 20.0497 21.2536 20.6517 20.6516C21.2536 20.0497 21.5125 19.2919 21.6335 18.3918C21.75 17.5248 21.75 16.4225 21.75 15.0549V15C21.75 14.5858 21.4142 14.25 21 14.25C20.5858 14.25 20.25 14.5858 20.25 15C20.25 16.4354 20.2484 17.4365 20.1469 18.1919C20.0482 18.9257 19.8678 19.3142 19.591 19.591C19.3142 19.8678 18.9257 20.0482 18.1919 20.1469C17.4365 20.2484 16.4354 20.25 15 20.25H9C7.56459 20.25 6.56347 20.2484 5.80812 20.1469C5.07435 20.0482 4.68577 19.8678 4.40901 19.591C4.13225 19.3142 3.9518 18.9257 3.85315 18.1919C3.75159 17.4365 3.75 16.4354 3.75 15Z" fill="#1C274C"/>
</svg>
            </div>
        </button>
          </a>
        </div>
      `);
      $fileElement.find(".extension").text(outputFormat).addClass("active");
      $fileElement.find(".remove-selected-file").remove();

      // When conversion is complete, set to 100%
      $fileElement.find(".progress-text").text(`Converting... 100%`);
      $fileElement.find(".progress-bar").css("width", `100%`);

      // Show finished status
      $fileElement.addClass("converted");
      setTimeout(() => {
        $fileElement.find(".select-convert-format").html(`
          <span class="badge bg-success">Finished</span>
        `);
      }, 500);

      // ouput file size set in file size
      const fileSize = formatFileSize(blob.size);
      $fileElement.find(".file-size").text(fileSize);

      // Clean up
      ffmpeg.FS("unlink", inputFileName);
      ffmpeg.FS("unlink", outputFileName);

      currentConversion = outputFormat;
    } catch (err) {
      if (!isConversionCancelled) {
        showError("Conversion failed. Please try a different file or format.");
        console.error("Conversion error:", err);
      }
    } finally {
      currentFFmpegCommand = null;
      ffmpeg.setProgress(null);
    }
  }

  if (isConversionCancelled) {
    // Reset UI
    $(".cancel-conversation").addClass("hidden");
    isConversionCancelled = false;
    return;
  }

  // Reset UI after all conversions
  $(".cancel-conversation").addClass("hidden");
  $("#convert-btn").addClass("hidden");
  $(".upload-more-files").prop("disabled", false);
  $(".add-more-files").addClass("hidden");
  $(".convert-more-files").removeClass("hidden");
  $(".tab").removeClass("disabled");
  $(".file .remove-selected-file").css("pointer-events", "auto");
  currentFFmpegCommand = null;
  $("#file-info-container .heading strong").text("Converted Files");
});

// Get MIME type for the blob
function getMimeType(format) {
  const mimeTypes = {
    // Image formats
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    tiff: "image/tiff",
    jpeg: "image/jpeg",
    jfif: "image/jpeg",
    pjpeg: "image/jpeg",
    pjp: "image/jpeg",

    // Audio formats
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    aac: "audio/aac",
    m4a: "audio/mp4",
    flac: "audio/flac",
    wma: "audio/x-ms-wma",
    m4a: "audio/mp4",

    // Video formats
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    mkv: "video/x-matroska",
  };

  return mimeTypes[format] || "application/octet-stream";
}
// });

// Toggle Editor Theme
$(document).on("change", ".theme-btn .change-editor-theme", function () {
  let $parent = $(this).parents(".theme-btn"),
    $this = $(this);

  if (!$this.is(":checked")) {
    $("body").addClass("dark-mode");
    localStorage.setItem("theme", "dark");
  } else {
    $("body").removeClass("dark-mode");
    localStorage.setItem("theme", "light");
  }
});

$(document).ready(function () {
  let theme = localStorage.getItem("theme");
  if (theme === "dark") {
    $("body").addClass("dark-mode");
    $(".theme-btn .change-editor-theme").click();
  }
});

// Remove alert message
$(".alert .close-alert").click(function () {
  $(this).parents(".alert").addClass("hidden");
});
