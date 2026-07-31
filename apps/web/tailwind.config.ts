import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f6f7fb",
          100: "#e6e8f3",
          200: "#cdd2e8",
          300: "#a7b0d8",
          400: "#7b88c0",
          500: "#5261a6",
          600: "#3d4b86",
          700: "#2f3968",
          800: "#202849",
          900: "#11172b",
        },
        ember: {
          50: "#fff6ec",
          100: "#ffe8ca",
          200: "#ffd39a",
          300: "#ffb867",
          400: "#ff9d3c",
          500: "#f47f1f",
          600: "#c96410",
          700: "#9f4b10",
          800: "#7e3b12",
          900: "#4f2510",
        },
      },
      boxShadow: {
        glow: "0 18px 60px rgba(244, 127, 31, 0.18)",
      },
      backgroundImage: {
        aurora:
          "radial-gradient(circle at top left, rgba(255, 183, 103, 0.22), transparent 30%), radial-gradient(circle at top right, rgba(82, 97, 166, 0.2), transparent 28%), linear-gradient(180deg, #f7f8fb 0%, #eef1f8 100%)",
      },
    },
  },
  plugins: [],
}

export default config
