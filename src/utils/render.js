function renderTemplate(app, view, data) {
  return new Promise((resolve, reject) => {
    app.render(view, data, (error, html) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(html);
    });
  });
}

async function renderPage(req, res, view, data = {}) {
  const body = await renderTemplate(req.app, view, {
    ...res.locals,
    ...data
  });

  res.render("layout", {
    ...res.locals,
    ...data,
    body
  });
}

module.exports = {
  renderPage
};
