package main

import (
	"flag"
	"os"

	"go.uber.org/zap/zapcore"
	"k8s.io/apimachinery/pkg/runtime"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	clientgoscheme "k8s.io/client-go/kubernetes/scheme"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/healthz"
	"sigs.k8s.io/controller-runtime/pkg/log/zap"
	metricsserver "sigs.k8s.io/controller-runtime/pkg/metrics/server"
	"sigs.k8s.io/controller-runtime/pkg/webhook"

	acmev1alpha1 "github.com/geektr-cloud/acme-hub/integrations/kubernetes/api/v1alpha1"
	"github.com/geektr-cloud/acme-hub/integrations/kubernetes/internal/acmehub"
	"github.com/geektr-cloud/acme-hub/integrations/kubernetes/internal/controller"
)

var (
	scheme   = runtime.NewScheme()
	setupLog = ctrl.Log.WithName("setup")
)

func init() {
	utilruntime.Must(clientgoscheme.AddToScheme(scheme))
	utilruntime.Must(acmev1alpha1.AddToScheme(scheme))
}

// +kubebuilder:rbac:groups=coordination.k8s.io,resources=leases,verbs=get;list;watch;create;update;patch

func main() {
	var metricsAddr string
	var enableLeaderElection bool
	var probeAddr string
	var clusterResourceNamespace string
	flag.StringVar(&metricsAddr, "metrics-bind-address", ":8080", "The address the metric endpoint binds to.")
	flag.StringVar(&probeAddr, "health-probe-bind-address", ":8081", "The address the probe endpoint binds to.")
	flag.BoolVar(&enableLeaderElection, "leader-elect", false,
		"Enable leader election for controller manager, ensuring only one active controller manager.")
	flag.StringVar(&clusterResourceNamespace, "cluster-resource-namespace", "acmehub-system",
		"The namespace for ClusterACMEHubConsumer token Secrets.")

	opts := zap.Options{
		Development: true,
		Level:       zapcore.InfoLevel,
	}
	opts.BindFlags(flag.CommandLine)
	flag.Parse()

	ctrl.SetLogger(zap.New(zap.UseFlagOptions(&opts)))

	acmeHubProxy, err := acmehub.ParseProxy(os.Getenv("ACME_HUB_PROXY"))
	if err != nil {
		setupLog.Error(err, "invalid ACME_HUB_PROXY")
		os.Exit(1)
	}

	mgr, err := ctrl.NewManager(ctrl.GetConfigOrDie(), ctrl.Options{
		Scheme: scheme,
		Metrics: metricsserver.Options{
			BindAddress: metricsAddr,
		},
		WebhookServer: webhook.NewServer(webhook.Options{
			Port: 9443,
		}),
		HealthProbeBindAddress: probeAddr,
		LeaderElection:         enableLeaderElection,
		LeaderElectionID:       "acmehub-syncer.geektr.cloud",
	})
	if err != nil {
		setupLog.Error(err, "unable to start manager")
		os.Exit(1)
	}

	if err = (&controller.ACMEHubCertificateReconciler{
		Client:                   mgr.GetClient(),
		Scheme:                   mgr.GetScheme(),
		Recorder:                 mgr.GetEventRecorderFor("acmehubcertificate-controller"),
		ClusterResourceNamespace: clusterResourceNamespace,
		AcmeHubProxy:             acmeHubProxy,
	}).SetupWithManager(mgr); err != nil {
		setupLog.Error(err, "unable to create controller", "controller", "ACMEHubCertificate")
		os.Exit(1)
	}
	if err = (&controller.ACMEHubConsumerReconciler{
		Client: mgr.GetClient(),
		Scheme: mgr.GetScheme(),
	}).SetupWithManager(mgr); err != nil {
		setupLog.Error(err, "unable to create controller", "controller", "ACMEHubConsumer")
		os.Exit(1)
	}
	if err = (&controller.ClusterACMEHubConsumerReconciler{
		Client: mgr.GetClient(),
		Scheme: mgr.GetScheme(),
	}).SetupWithManager(mgr); err != nil {
		setupLog.Error(err, "unable to create controller", "controller", "ClusterACMEHubConsumer")
		os.Exit(1)
	}

	if err := mgr.AddHealthzCheck("healthz", healthz.Ping); err != nil {
		setupLog.Error(err, "unable to set up health check")
		os.Exit(1)
	}
	if err := mgr.AddReadyzCheck("readyz", healthz.Ping); err != nil {
		setupLog.Error(err, "unable to set up ready check")
		os.Exit(1)
	}

	setupLog.Info("starting manager")
	if err := mgr.Start(ctrl.SetupSignalHandler()); err != nil {
		setupLog.Error(err, "problem running manager")
		os.Exit(1)
	}
}
