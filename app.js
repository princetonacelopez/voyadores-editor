let savedDocs = JSON.parse(localStorage.getItem('savedDocs')) || [];

function updateSavedDocsList() {
    let menuItems = savedDocs.map((doc, index) => ({
        type: 'menuitem',
        text: doc.title,
        onAction: () => loadDocument(index)
    }));
    tinymce.activeEditor.ui.registry.addMenuButton('loadmenu', {
        text: 'Load',
        fetch: (callback) => callback(menuItems)
    });
}

function saveDocument() {
    const title = prompt('Enter a title for your document:');
    if (title) {
        const content = tinymce.activeEditor.getContent({ format: 'raw' });
        savedDocs.push({ title, content });
        localStorage.setItem('savedDocs', JSON.stringify(savedDocs));
        updateSavedDocsList();
    }
}

function loadDocument(index) {
    if (index >= 0 && index < savedDocs.length) {
        tinymce.activeEditor.setContent(savedDocs[index].content);
    }
}

function exportToJson() {
    const content = tinymce.activeEditor.getContent({ format: 'raw' });
    const jsonContent = JSON.stringify({ content });
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.json';
    a.click();
    URL.revokeObjectURL(url);
}

tinymce.init({
    selector: '#editor-container',
    plugins: 'fullscreen code image link lists table',
    toolbar: 'undo redo | formatselect | bold italic | alignleft aligncenter alignright | bullist numlist outdent indent | image link table | fullscreen | code | customsave customexport loadmenu | styleselect',
    menubar: 'file edit view insert format tools table',
    menu: {
        file: { title: 'File', items: 'newdocument customsave customexport loadmenu' }
    },
    statusbar: false,
    height: '100vh',
    fullscreen_native: true,
    font_formats: 'Urbanist=Urbanist, sans-serif;',
    font_family_formats: 'Urbanist=Urbanist, sans-serif;',
    default_font_stack: [ 'Urbanist', '-apple-system' ],
    body_class: 'container-fluid py-3',
    content_css: [
'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css',
'https://fonts.googleapis.com/css2?family=Urbanist:wght@300;400;500;700&display=swap'
],
    content_style: ` 
    body {
        font-family: 'Urbanist', sans-serif;
        font-size: 16px;
    }
    .mce-content-body {
        font-family: 'Urbanist', sans-serif !important;
    }`
    ,
    formats: {
        // Add CSS classes for Bootstrap tags
        h1: {
            block:
                'h1'
            , classes:
                'h1'
        }, h2: {
            block:
                'h2'
            , classes:
                'h2'
        }, h3: {
            block:
                'h3'
            , classes:
                'h3'
        }, h4: {
            block:
                'h4'
            , classes:
                'h4'
        }, h5: {
            block:
                'h5'
            , classes:
                'h5'
        }, h6: {
            block:
                'h6'
            , classes:
                'h6'
        }, p: {
            block:
                'p'
            , classes:
                'p'
        }, div: {
            block:
                'div'
            , classes:
                'div'
        }, span: {
            inline:
                'span'
            , classes:
                'span'
        }, a: {
            inline:
                'a'
            , classes:
                'link'
        }, img: {
            block:
                'img'
            , classes:
                'img-fluid'
        },
    },
        setup: function (editor) {
            editor.ui.registry.addButton('customsave', {
                text: 'Save',
                onAction: saveDocument
            });
            editor.ui.registry.addButton('customexport', {
                text: 'Export to JSON',
                onAction: exportToJson
            });
            editor.ui.registry.addMenuButton('loadmenu', {
                text: 'Load',
                fetch: (callback) => {
                    let items = savedDocs.map((doc, index) => ({
                        type: 'menuitem',
                        text: doc.title,
                        onAction: () => loadDocument(index)
                    }));
                    callback(items);
                }
            });
        },
        init_instance_callback: function (editor) {
            updateSavedDocsList();
        }
    });