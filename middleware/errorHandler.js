/**
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const errorHandler = (err, req, res, next) => {
  console.error(`🔥 FATAL ERROR: ${err?.message}`);
  console.error(err?.stack);

  res.status(500).json({
    error: "Internal Server Error",
    // Only send the exact error message in development mode for security
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
};