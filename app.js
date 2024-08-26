let currentDoc = null;
let editor = null;
let autosaveInterval = null;
let savedDocs = JSON.parse(localStorage.getItem("savedDocs")) || [];
const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

function showInitialDialog() {
	const modal = new bootstrap.Modal(document.getElementById("initialDialog"));
	updateRecentDocumentsGrid();
	modal.show();
}

function updateRecentDocumentsGrid() {
	const grid = document.getElementById("recentDocumentsGrid");
	if (savedDocs.length !== 0) {
		grid.innerHTML = "";
		savedDocs.forEach((doc, index) => {
			const item = document.createElement("div");
			item.className = "document-item col-6 col-md-4";
			item.innerHTML = `
                    <img src="${doc.thumbnailBase64}" alt="${doc.title}" class="img-thumbnail" height="130">
                    <p class="mb-0">${doc.title}</p>
                    <p class="date-modified small text-secondary mb-0">${formatRelativeTime(doc.dateModified)}</p>
                `;
			item.addEventListener("click", () => loadDocument(index));
			grid.appendChild(item);
		});
	}
}

function formatRelativeTime(dateString) {
	const date = new Date(dateString);
	const now = new Date();
	
	// Check if the date is valid
	if (isNaN(date.getTime())) {
		console.error('Invalid date:', dateString);
		return 'Invalid date';
	}

	const diffInSeconds = Math.floor((now - date) / 1000);

	// Ensure the difference is a finite number
	if (!Number.isFinite(diffInSeconds)) {
		console.error('Invalid time difference:', diffInSeconds);
		return 'Unknown time ago';
	}

	if (diffInSeconds < 60) {
		return rtf.format(-Math.min(diffInSeconds, 59), 'second');
	} else if (diffInSeconds < 3600) {
		return rtf.format(-Math.min(Math.floor(diffInSeconds / 60), 59), 'minute');
	} else if (diffInSeconds < 86400) {
		return rtf.format(-Math.min(Math.floor(diffInSeconds / 3600), 23), 'hour');
	} else {
		return rtf.format(-Math.min(Math.floor(diffInSeconds / 86400), 30), 'day');
	}
}

function showNewDocDialog() {
	const modal = new bootstrap.Modal(document.getElementById("newDocDialog"));
	modal.show();
}

function createNewDocument(event) {
    event.preventDefault();
    const slug = document.getElementById('docSlug').value;
    const title = document.getElementById('docTitle').value;
    const type = document.getElementById('docType').value;
    const bannerFile = document.getElementById('docBanner').files[0];

    // Create the banner path using the file name
    const bannerPath = `/Content/images/social-post/${bannerFile.name}`;

    // Create base64 thumbnail
    const reader = new FileReader();
    reader.onload = function(e) {
        currentDoc = {
            slug: slug,
            type: type,
            title: title,
            banner: bannerPath,
            thumbnailBase64: e.target.result,
            dateModified: new Date().toISOString(),
            content: ""
        };

        bootstrap.Modal.getInstance(document.getElementById('newDocDialog')).hide();
        initEditor();

        // In a real-world scenario, you would upload the file to the server here
        console.log(`File ${bannerFile.name} would be uploaded to ${bannerPath}`);
    };
    reader.readAsDataURL(bannerFile);
}


function loadDocument(index) {
	if (index >= 0 && index < savedDocs.length) {
		currentDoc = savedDocs[index];
		if (editor) {
			editor.setContent(currentDoc.content);
			startAutosave();
		} else {
			initEditor();
		}
		bootstrap.Modal.getInstance(document.getElementById('initialDialog')).hide();
	}
}

function loadMostRecentDocument() {
	if (savedDocs.length > 0) {
		savedDocs.sort((a, b) => new Date(b.dateModified) - new Date(a.dateModified));
		currentDoc = savedDocs[0];
		if (editor) {
			editor.setContent(currentDoc.content);
		} else {
			initEditor();
		}
	} else {
		alert("No recent documents found. Please create a new document.");
	}
}

function startAutosave() {
	if (autosaveInterval) {
		clearInterval(autosaveInterval);
	}
	autosaveInterval = setInterval(autosaveDocument, 30000); // Autosave every 30 seconds
}

function stopAutosave() {
	if (autosaveInterval) {
		clearInterval(autosaveInterval);
		autosaveInterval = null;
	}
}

function autosaveDocument() {
	if (currentDoc && editor) {
		currentDoc.content = editor.getContent();
		currentDoc.dateModified = new Date().toISOString();
		const existingIndex = savedDocs.findIndex(doc => doc.slug === currentDoc.slug);
		if (existingIndex !== -1) {
			savedDocs[existingIndex] = currentDoc;
		} else {
			savedDocs.push(currentDoc);
		}
		localStorage.setItem('savedDocs', JSON.stringify(savedDocs));
		console.log("Document autosaved at", new Date().toLocaleTimeString());
	}
}

function saveDocument() {
	if (currentDoc && editor) {
		currentDoc.content = editor.getContent();
		currentDoc.dateModified = new Date().toISOString();
		const existingIndex = savedDocs.findIndex(doc => doc.slug === currentDoc.slug);
		if (existingIndex !== -1) {
			savedDocs[existingIndex] = currentDoc;
		} else {
			savedDocs.push(currentDoc);
		}
		localStorage.setItem('savedDocs', JSON.stringify(savedDocs));
		alert("Document saved successfully!");
	}
}

function exportToJson() {
	if (currentDoc && editor) {
		currentDoc.content = editor.getContent();
		const exportDoc = {...currentDoc};
		delete exportDoc.thumbnailBase64;  // Remove the base64 thumbnail from the export
		const jsonContent = JSON.stringify({ entries: [exportDoc] }, null, 2);
		const blob = new Blob([jsonContent], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${currentDoc.slug}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}
}

function closeDocument() {
	if (editor) {
		stopAutosave();
		editor.setContent('');
		currentDoc = null;
		showInitialDialog();
	}
}

document.getElementById("newDocBtn").addEventListener("click", () => {
	bootstrap.Modal.getInstance(document.getElementById("initialDialog")).hide();
	showNewDocDialog();
});

document
	.getElementById("newDocForm")
	.addEventListener("submit", createNewDocument);

// Show initial dialog when the page loads
window.addEventListener("load", showInitialDialog);

function initEditor() {
	if (editor) {
		editor.setContent(currentDoc ? currentDoc.content : '');
		document.getElementById("editor-container").classList.remove("d-none");
		return;
	}

	tinymce.init({
		selector: "#editor-container",
		plugins: "fullscreen code image link lists table",
		toolbar: 'undo redo | formatselect | bold italic | alignleft aligncenter alignright | bullist numlist outdent indent | image link table | fullscreen | code',
		menubar: "file edit view insert format tools table",
		menu: {
			file: { title: 'File', items: 'newdocument restoredraft | preview | print | save export | closedocument loadrecent' }
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
		autosave_interval: '30s',
                autosave_prefix: 'tinymce-autosave-{path}{query}-{id}-',
                autosave_restore_when_empty: true,
                autosave_retention: '1440m',
		setup: function (ed) {
			editor = ed;
			editor.on('init', function () {
				if (currentDoc) {
					editor.setContent(currentDoc.content);
				}
				startAutosave();
			});
			editor.ui.registry.addMenuItem('closedocument', {
				text: 'Close Document',
				onAction: closeDocument
			});
			editor.ui.registry.addMenuItem('loadrecent', {
				text: 'Load Recent Document',
				onAction: loadMostRecentDocument
			});
			editor.ui.registry.addMenuItem('save', {
				text: 'Save',
				onAction: saveDocument
			});
			editor.ui.registry.addMenuItem('export', {
				text: 'Export to JSON',
				onAction: exportToJson
			});
		},
	});
}
