let currentDoc = null;
let editor = null;
const DB_NAME = "EditorDatabase";
const STORE_NAME = "documents";
let db;

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

// Initialize IndexedDB
async function initDB() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, 1);
		request.onerror = (event) =>
			reject("IndexedDB error: " + event.target.error);
		request.onsuccess = (event) => {
			db = event.target.result;
			resolve(db);
		};
		request.onupgradeneeded = (event) => {
			db = event.target.result;
			db.createObjectStore(STORE_NAME, { keyPath: "slug" });
		};
	});
}

// Load documents from IndexedDB
async function loadDocuments() {
	const docKeys = JSON.parse(localStorage.getItem("documentKeys") || "[]");
	const docs = [];

	for (const key of docKeys) {
		const doc = await new Promise((resolve, reject) => {
			const transaction = db.transaction([STORE_NAME], "readonly");
			const objectStore = transaction.objectStore(STORE_NAME);
			const request = objectStore.get(key);
			request.onerror = (event) => reject("Load error: " + event.target.error);
			request.onsuccess = (event) => resolve(event.target.result);
		});
		if (doc) docs.push(doc);
	}

	return docs;
}

// Save document to IndexedDB
async function saveDocumentToDB(doc) {
	return new Promise((resolve, reject) => {
		const transaction = db.transaction([STORE_NAME], "readwrite");
		const objectStore = transaction.objectStore(STORE_NAME);
		const request = objectStore.put(doc);
		// Update localStorage with the document key
		let docKeys = JSON.parse(localStorage.getItem("documentKeys") || "[]");
		if (!docKeys.includes(doc.slug)) {
			docKeys.push(doc.slug);
			localStorage.setItem("documentKeys", JSON.stringify(docKeys));
		}
		request.onerror = (event) => reject("Save error: " + event.target.error);
		request.onsuccess = (event) => resolve(event.target.result);
	});
}

async function showInitialDialog() {
	try {
		const savedDocs = await loadDocuments();
		updateRecentDocumentsGrid(savedDocs);
		const modal = new bootstrap.Modal(document.getElementById("initialDialog"));
		modal.show();
	} catch (error) {
		console.error("Error loading documents:", error);
	}
}

function updateRecentDocumentsGrid(savedDocs) {
	const grid = document.getElementById("recentDocumentsGrid");
	grid.innerHTML = "";
	if (savedDocs && savedDocs.length > 0) {
		savedDocs.forEach((doc) => {
			const item = document.createElement("div");
			item.className = "document-item col-6 col-md-4";
			item.innerHTML = `
                <img src="${doc.thumbnailBase64}" alt="${
				doc.title
			}" class="document-thumbnail img-thumbnail">
                <p class="fw-bold mb-0">${doc.title}</p>
                <p class="date-modified small mb-0">${formatRelativeTime(
									doc.dateModified
								)}</p>
            `;
			item.addEventListener("click", () => loadDocument(doc));
			grid.appendChild(item);
		});
	} else {
		grid.innerHTML = `<div class="col-6 col-md-4 card document-thumbnail bg-secondary-subtle px-0"><p class="m-auto">No recent documents found.</p></div>`;
	}
}

function formatRelativeTime(dateString) {
	const date = new Date(dateString);
	const now = new Date();

	// Check if the date is valid
	if (isNaN(date.getTime())) {
		console.error("Invalid date:", dateString);
		return "Invalid date";
	}

	const diffInSeconds = Math.floor((now - date) / 1000);

	// Ensure the difference is a finite number
	if (!Number.isFinite(diffInSeconds)) {
		console.error("Invalid time difference:", diffInSeconds);
		return "Unknown time ago";
	}

	if (diffInSeconds < 60) {
		return rtf.format(-Math.min(diffInSeconds, 59), "second");
	} else if (diffInSeconds < 3600) {
		return rtf.format(-Math.min(Math.floor(diffInSeconds / 60), 59), "minute");
	} else if (diffInSeconds < 86400) {
		return rtf.format(-Math.min(Math.floor(diffInSeconds / 3600), 23), "hour");
	} else {
		return rtf.format(-Math.min(Math.floor(diffInSeconds / 86400), 30), "day");
	}
}

function showNewDocDialog() {
	const modal = new bootstrap.Modal(document.getElementById("newDocDialog"));
	modal.show();
}

function createNewDocument(event) {
	event.preventDefault();
	const slug = document.getElementById("docSlug").value;
	const title = document.getElementById("docTitle").value;
	const type = document.getElementById("docType").value;
	const bannerFile = document.getElementById("docBanner").files[0];

	// Create the banner path using the file name
	const bannerPath = `/Content/images/social-post/${bannerFile.name}`;

	// Create base64 thumbnail
	const reader = new FileReader();
	reader.onload = function (e) {
		currentDoc = {
			slug: slug,
			type: type,
			title: title,
			banner: bannerPath,
			thumbnailBase64: e.target.result,
			dateModified: new Date().toISOString(),
			content: "",
		};

		bootstrap.Modal.getInstance(document.getElementById("newDocDialog")).hide();
		initEditor();

		// In a real-world scenario, you would upload the file to the server here
		console.log(`File ${bannerFile.name} would be uploaded to ${bannerPath}`);
	};
	reader.readAsDataURL(bannerFile);
}

function loadDocument(doc) {
	currentDoc = doc;
	if (editor) {
		editor.setContent(currentDoc.content);
	} else {
		initEditor();
	}
	bootstrap.Modal.getInstance(document.getElementById("initialDialog")).hide();
}

async function loadMostRecentDocument() {
	const savedDocs = await loadDocuments();
	if (savedDocs.length > 0) {
		savedDocs.sort(
			(a, b) => new Date(b.dateModified) - new Date(a.dateModified)
		);
		loadDocument(savedDocs[0]);
	} else {
		alert("No recent documents found. Please create a new document.");
	}
}

function autosaveDocument() {
	if (currentDoc && editor) {
		currentDoc.content = editor.getContent();
		currentDoc.dateModified = new Date().toISOString();
		const existingIndex = savedDocs.findIndex(
			(doc) => doc.slug === currentDoc.slug
		);
		if (existingIndex !== -1) {
			savedDocs[existingIndex] = currentDoc;
		} else {
			savedDocs.push(currentDoc);
		}
		localStorage.setItem("savedDocs", JSON.stringify(savedDocs));
		console.log("Document autosaved at", new Date().toLocaleTimeString());
	}
}

function closeDocument() {
	if (editor) {
		editor.setContent("");
		currentDoc = null;
		showInitialDialog();
	}
}

async function saveDocument() {
	if (currentDoc && editor) {
		currentDoc.content = editor.getContent();
		currentDoc.dateModified = new Date().toISOString();
		await saveDocumentToDB(currentDoc);
		alert("Document saved successfully!");
	}
}

function exportToJson() {
	if (currentDoc && editor) {
		currentDoc.content = editor.getContent();
		const exportDoc = { ...currentDoc };
		delete exportDoc.thumbnailBase64; // Remove the base64 thumbnail from the export
		const jsonContent = JSON.stringify({ entries: [exportDoc] }, null, 2);
		const blob = new Blob([jsonContent], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${currentDoc.slug}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}
}

function importFromJson() {
	const fileInput = document.getElementById("jsonFileInput");
	fileInput.click();

	fileInput.onchange = function (event) {
		const file = event.target.files[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = function (e) {
				try {
					const jsonContent = JSON.parse(e.target.result);
					if (jsonContent.entries && jsonContent.entries.length > 0) {
						const importedDoc = jsonContent.entries[0];
						currentDoc = {
							slug: importedDoc.slug || generateSlug(),
							type: importedDoc.type || "Imported",
							title: importedDoc.title || "Imported Document",
							banner: importedDoc.banner || "",
							content: importedDoc.content || "",
							dateModified: new Date().toISOString(),
						};
						editor.setContent(currentDoc.content);
						saveDocumentToDB(currentDoc);
						alert("Document imported successfully!");
					} else {
						throw new Error("Invalid JSON structure");
					}
				} catch (error) {
					console.error("Error parsing JSON:", error);
					alert("Error importing JSON. Please check the file format.");
				}
			};
			reader.readAsText(file);
		}
	};
}

function generateSlug() {
	return "doc-" + Math.random().toString(36).substr(2, 9);
}

document.getElementById("newDocBtn").addEventListener("click", () => {
	bootstrap.Modal.getInstance(document.getElementById("initialDialog")).hide();
	showNewDocDialog();
});

document
	.getElementById("newDocForm")
	.addEventListener("submit", createNewDocument);

function showEditDocInfoModal() {
	if (!currentDoc) {
		alert("No document is currently open.");
		return;
	}

	document.getElementById("editDocSlug").value = currentDoc.slug;
	document.getElementById("editDocTitle").value = currentDoc.title;
	document.getElementById("editDocType").value = currentDoc.type;

	const modal = new bootstrap.Modal(
		document.getElementById("editDocInfoModal")
	);
	modal.show();
}

async function saveDocInfo() {
	const newSlug = document.getElementById("editDocSlug").value;
	const newTitle = document.getElementById("editDocTitle").value;
	const newType = document.getElementById("editDocType").value;
	const newBannerFile = document.getElementById("editDocBanner").files[0];

	// If slug has changed, we need to update our storage
	if (newSlug !== currentDoc.slug) {
		await deleteDocumentFromDB(currentDoc.slug);
		let docKeys = JSON.parse(localStorage.getItem("documentKeys") || "[]");
		docKeys = docKeys.filter((key) => key !== currentDoc.slug);
		docKeys.push(newSlug);
		localStorage.setItem("documentKeys", JSON.stringify(docKeys));
	}

	currentDoc.slug = newSlug;
	currentDoc.title = newTitle;
	currentDoc.type = newType;

	if (newBannerFile) {
		const reader = new FileReader();
		reader.onload = async function (e) {
			currentDoc.banner = e.target.result;
			currentDoc.thumbnailBase64 = e.target.result;
			await saveDocumentToDB(currentDoc);
			bootstrap.Modal.getInstance(
				document.getElementById("editDocInfoModal")
			).hide();
			alert("Document info updated successfully!");
		};
		reader.readAsDataURL(newBannerFile);
	} else {
		await saveDocumentToDB(currentDoc);
		bootstrap.Modal.getInstance(
			document.getElementById("editDocInfoModal")
		).hide();
		alert("Document info updated successfully!");
	}
}

async function deleteDocumentFromDB(slug) {
	return new Promise((resolve, reject) => {
		const transaction = db.transaction([STORE_NAME], "readwrite");
		const objectStore = transaction.objectStore(STORE_NAME);
		const request = objectStore.delete(slug);
		request.onerror = (event) => reject("Delete error: " + event.target.error);
		request.onsuccess = (event) => resolve();
	});
}
window.addEventListener("load", async () => {
	try {
		await initDB();
		initEditor();
		await showInitialDialog();
	} catch (error) {
		console.error("Error initializing the application:", error);
	}
});

function initEditor() {
	if (editor) {
		editor.setContent(currentDoc ? currentDoc.content : "");
		return;
	}

	tinymce.init({
		selector: "#editor-container",
		plugins: "fullscreen code image link lists table",
		toolbar:
			"undo redo | formatselect | bold italic | alignleft aligncenter alignright | bullist numlist outdent indent | image link table | fullscreen | code",
		menubar: "file edit view insert format tools",
		menu: {
			file: {
				title: "File",
				items:
					"newdocument loadrecent restoredraft | editdocinfo preview print | save export importjson | closedocument",
			},
		},
		statusbar: false,
		height: "100vh",
		fullscreen_native: true,
		font_formats: "Urbanist=Urbanist, sans-serif;",
		font_family_formats: "Urbanist=Urbanist, sans-serif;",
		default_font_stack: ["Urbanist", "-apple-system"],
		body_class: "container-fluid py-3",
		content_css: [
			"https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css",
			"https://fonts.googleapis.com/css2?family=Urbanist:wght@300;400;500;700&display=swap",
		],
		content_style: ` 
            body {
                font-family: 'Urbanist', sans-serif;
                font-size: 16px;
            }
            .mce-content-body {
                font-family: 'Urbanist', sans-serif !important;
            }`,
		formats: {
			// Add CSS classes for Bootstrap tags
			h1: {
				block: "h1",
				classes: "h1",
			},
			h2: {
				block: "h2",
				classes: "h2",
			},
			h3: {
				block: "h3",
				classes: "h3",
			},
			h4: {
				block: "h4",
				classes: "h4",
			},
			h5: {
				block: "h5",
				classes: "h5",
			},
			h6: {
				block: "h6",
				classes: "h6",
			},
			p: {
				block: "p",
				classes: "p",
			},
			div: {
				block: "div",
				classes: "div",
			},
			span: {
				inline: "span",
				classes: "span",
			},
			a: {
				inline: "a",
				classes: "link",
			},
			img: {
				block: "img",
				classes: "img-fluid",
			},
		},
		autosave_interval: "30s",
		autosave_prefix: "voyadores-autosave-{path}{query}-{id}-",
		autosave_restore_when_empty: true,
		autosave_retention: "1440m",
		setup: function (ed) {
			editor = ed;
			editor.on("init", function () {
				if (currentDoc) {
					editor.setContent(currentDoc.content);
				}
			});
			editor.ui.registry.addMenuItem("closedocument", {
				text: "Close Document",
				onAction: closeDocument,
			});
			editor.ui.registry.addMenuItem("loadrecent", {
				text: "Load Recent Document",
				onAction: loadMostRecentDocument,
			});
			editor.ui.registry.addMenuItem("save", {
				text: "Save",
				onAction: saveDocument,
			});
			editor.ui.registry.addMenuItem("export", {
				text: "Export to JSON",
				onAction: exportToJson,
			});
			editor.ui.registry.addMenuItem("importjson", {
				text: "Import from JSON",
				onAction: importFromJson,
			});
			editor.ui.registry.addMenuItem("editdocinfo", {
				text: "Edit Document Info",
				onAction: showEditDocInfoModal,
			});
		},
	});
}
