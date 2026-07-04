import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/useColorScheme";

export function useTheme() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme === "dark" ? "dark" : "light";
  const isDark = scheme === "dark";
  const theme = Colors[scheme];

  return {
    theme,
    isDark,
  };
}
