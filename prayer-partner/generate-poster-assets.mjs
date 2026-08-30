import QRCode from "qrcode";

const applicationUrl = "https://amicus-prayer-partner.vercel.app/partner.html?code=AMICUS26";

await QRCode.toFile("assets/prayer-partner-qr-amicus26.png", applicationUrl, {
  errorCorrectionLevel: "H",
  margin: 3,
  width: 1200,
  color: {
    dark: "#173F2DFF",
    light: "#FBF8EFFF"
  }
});

console.log(`Created QR code for ${applicationUrl}`);
