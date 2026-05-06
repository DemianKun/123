#include <WiFi.h>
#include <HTTPClient.h>
#include "HX711.h"
#include <OneWire.h>
#include <DallasTemperature.h>

// --- Configuración WiFi ---
const char* ssid = "TU_RED_WIFI";
const char* password = "TU_PASSWORD";

// --- Configuración Servidor Backend ---
// Cambiar por la IP local de tu PC ejecutando FastAPI (ej. http://192.168.1.100:8000)
const char* serverUrl = "http://192.168.1.100:8000/api/iot/data";

// --- Pines HX711 (Sensor de Peso 1) ---
const int LOADCELL_1_DOUT_PIN = 16;
const int LOADCELL_1_SCK_PIN = 4;
HX711 scale1;
float calibration_factor_1 = -10000.0; // Ajustar con peso conocido para sensor 1

// --- Pines HX711 (Sensor de Peso 2) ---
const int LOADCELL_2_DOUT_PIN = 18;
const int LOADCELL_2_SCK_PIN = 19;
HX711 scale2;
float calibration_factor_2 = -10000.0; // Ajustar con peso conocido para sensor 2

// --- Pines DS18B20 (Sensor de Temperatura de la Cámara Fría) ---
const int ONE_WIRE_BUS = 15;
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

// --- Tiempos ---
unsigned long lastTime = 0;
unsigned long timerDelay = 10000; // Enviar datos cada 10 segundos

void setup() {
  Serial.begin(115200);
  
  // Iniciar WiFi
  WiFi.begin(ssid, password);
  Serial.println("Conectando a WiFi...");
  while(WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConectado a la red WiFi");
  Serial.print("Dirección IP: ");
  Serial.println(WiFi.localIP());

  // Iniciar Sensores de Peso
  scale1.begin(LOADCELL_1_DOUT_PIN, LOADCELL_1_SCK_PIN);
  scale1.set_scale(calibration_factor_1);
  scale1.tare(); 

  scale2.begin(LOADCELL_2_DOUT_PIN, LOADCELL_2_SCK_PIN);
  scale2.set_scale(calibration_factor_2);
  scale2.tare(); 
  Serial.println("Básculas (Sensor 1 y Sensor 2) inicializadas.");

  sensors.begin();
  Serial.println("Sensor de temperatura inicializado.");
}

void loop() {
  if ((millis() - lastTime) > timerDelay) {
    if(WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      
      // Leer Temperatura (asumimos que ambos están en la misma cámara o es temperatura ambiente)
      sensors.requestTemperatures(); 
      float tempC = sensors.getTempCByIndex(0);
      
      // --- Leer y enviar Sensor 1 ---
      float weight1 = scale1.get_units(10); 
      if(weight1 < 0) weight1 = 0;
      
      String jsonPayload1 = "{\"device_id\":\"sensor_1\", \"temperatura\":" + String(tempC) + ", \"peso_kg\":" + String(weight1) + "}";
      Serial.print("Enviando Sensor 1: "); Serial.println(jsonPayload1);
      
      http.begin(serverUrl);
      http.addHeader("Content-Type", "application/json");
      int httpResponseCode1 = http.POST(jsonPayload1);
      if (httpResponseCode1 > 0) {
        Serial.print("Respuesta S1: "); Serial.println(httpResponseCode1);
      } else {
        Serial.print("Error HTTP S1: "); Serial.println(httpResponseCode1);
      }
      http.end();
      
      delay(500); // Pequeña pausa entre peticiones
      
      // --- Leer y enviar Sensor 2 ---
      float weight2 = scale2.get_units(10); 
      if(weight2 < 0) weight2 = 0;
      
      String jsonPayload2 = "{\"device_id\":\"sensor_2\", \"temperatura\":" + String(tempC) + ", \"peso_kg\":" + String(weight2) + "}";
      Serial.print("Enviando Sensor 2: "); Serial.println(jsonPayload2);
      
      http.begin(serverUrl);
      http.addHeader("Content-Type", "application/json");
      int httpResponseCode2 = http.POST(jsonPayload2);
      if (httpResponseCode2 > 0) {
        Serial.print("Respuesta S2: "); Serial.println(httpResponseCode2);
      } else {
        Serial.print("Error HTTP S2: "); Serial.println(httpResponseCode2);
      }
      http.end();
    } else {
      Serial.println("Error en la conexión WiFi");
    }
    lastTime = millis();
  }
}
