import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, signIn } = useAuth();
  const router = useRouter();

  if (user) return <Redirect href="/(tabs)" />;

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    setError("");
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace("/(tabs)");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Accesso non riuscito. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.logo}>L'Italiano</Text>
            <Text style={styles.tagline}>La tua palestra di conversazione</Text>

            <View style={styles.form}>
              <Text style={styles.label}>EMAIL</Text>
              <TextInput
                style={styles.input}
                placeholder="tu@example.com"
                placeholderTextColor="#a88a80"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                returnKeyType="next"
              />

              <Text style={[styles.label, { marginTop: 16 }]}>PASSWORD</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#a88a80"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="current-password"
                returnKeyType="go"
                onSubmitEditing={handleLogin}
              />

              {!!error && <Text style={styles.errorText}>{error}</Text>}

              <TouchableOpacity
                onPress={handleLogin}
                disabled={!email.trim() || !password || loading}
                style={[
                  styles.primaryBtn,
                  (!email.trim() || !password || loading) && { opacity: 0.5 },
                ]}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#5f1b00" />
                ) : (
                  <Text style={styles.primaryBtnText}>Accedi</Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => router.push("/(auth)/signup")}
              activeOpacity={0.7}
              style={styles.switchLink}
            >
              <Text style={styles.switchText}>
                Non hai un account?{" "}
                <Text style={styles.switchAccent}>Registrati</Text>
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#131313" },
  safe: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 32,
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: "center",
  },
  logo: {
    fontSize: 48,
    fontWeight: "800",
    color: "#ffb59b",
    letterSpacing: -1,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 14,
    fontWeight: "600",
    color: "#e1bfb4",
    marginBottom: 56,
  },
  form: { width: "100%", marginBottom: 32 },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: "#e1bfb4",
    letterSpacing: 2,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#1c1b1b",
    borderWidth: 2,
    borderColor: "#594139",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    fontSize: 16,
    color: "#e5e2e1",
    width: "100%",
  },
  errorText: {
    color: "#ff6d33",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 12,
    textAlign: "center",
  },
  primaryBtn: {
    backgroundColor: "#ff6d33",
    borderRadius: 50,
    paddingVertical: 20,
    alignItems: "center",
    marginTop: 24,
    shadowColor: "#ff6d33",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: { fontSize: 18, fontWeight: "700", color: "#5f1b00" },
  switchLink: { marginTop: 8 },
  switchText: { fontSize: 14, color: "#e1bfb4", textAlign: "center" },
  switchAccent: { color: "#ffb59b", fontWeight: "700" },
});
