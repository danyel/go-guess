{{- define "go-guess.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "go-guess.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "go-guess.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
app.kubernetes.io/name: {{ include "go-guess.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "go-guess.selectorLabels" -}}
app.kubernetes.io/name: {{ include "go-guess.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "go-guess.secretName" -}}
{{- printf "%s-secrets" (include "go-guess.fullname" .) }}
{{- end }}

{{- define "go-guess.postgresqlName" -}}
{{- printf "%s-postgresql" (include "go-guess.fullname" .) }}
{{- end }}

{{- define "go-guess.rabbitmqName" -}}
{{- printf "%s-rabbitmq" (include "go-guess.fullname" .) }}
{{- end }}
