function flashMiddleware(req, res, next) {
  res.locals.flash = req.session?.flash || null;

  if (req.session) {
    delete req.session.flash;
  }

  req.flash = function setFlash(type, message) {
    if (req.session) {
      req.session.flash = { type, message };
    }
  };

  next();
}

module.exports = {
  flashMiddleware
};
