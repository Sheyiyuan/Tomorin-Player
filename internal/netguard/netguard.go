// Package netguard provides HTTP clients that may only connect to public targets.
package netguard

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"strings"
	"time"
)

// Resolver is the subset of net.Resolver used by the public gateway.
type Resolver interface {
	LookupIPAddr(ctx context.Context, host string) ([]net.IPAddr, error)
}

// Config configures a public-target HTTP gateway. Resolver and DialContext are
// exposed so callers can provide platform-specific implementations and tests.
type Config struct {
	Timeout             time.Duration
	Resolver            Resolver
	DialContext         func(ctx context.Context, network, address string) (net.Conn, error)
	AllowedHostSuffixes []string
}

// NewPublicGateway constructs an HTTP client that rejects non-HTTP URLs,
// private/special-use targets, and unsafe redirect destinations. Hostnames are
// resolved by the gateway and the approved IP is passed directly to the dialer
// to prevent DNS rebinding between validation and connection.
func NewPublicGateway(config Config) *http.Client {
	resolver := config.Resolver
	if resolver == nil {
		resolver = net.DefaultResolver
	}
	dialContext := config.DialContext
	if dialContext == nil {
		dialContext = (&net.Dialer{
			Timeout:   10 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext
	}

	transport := &http.Transport{
		DialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			host, port, err := net.SplitHostPort(address)
			if err != nil {
				return nil, fmt.Errorf("parse target address: %w", err)
			}

			if err := validateAllowedHost(host, config.AllowedHostSuffixes); err != nil {
				return nil, err
			}
			addresses, err := resolvePublicAddresses(ctx, resolver, host)
			if err != nil {
				return nil, err
			}

			var lastErr error
			for _, address := range addresses {
				conn, err := dialContext(ctx, network, net.JoinHostPort(address.String(), port))
				if err == nil {
					return conn, nil
				}
				lastErr = err
			}
			return nil, fmt.Errorf("dial public target: %w", lastErr)
		},
		TLSHandshakeTimeout:   10 * time.Second,
		IdleConnTimeout:       90 * time.Second,
		ResponseHeaderTimeout: 30 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		MaxIdleConns:          100,
		MaxIdleConnsPerHost:   10,
	}

	return &http.Client{
		Transport: publicTargetTransport{base: transport, allowedHostSuffixes: config.AllowedHostSuffixes},
		Timeout:   config.Timeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 10 {
				return fmt.Errorf("stopped after 10 redirects")
			}
			if err := validateGatewayURL(req.URL, config.AllowedHostSuffixes); err != nil {
				return fmt.Errorf("redirect target rejected: %w", err)
			}
			return nil
		},
	}
}

type publicTargetTransport struct {
	base                http.RoundTripper
	allowedHostSuffixes []string
}

func (t publicTargetTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	if err := validateGatewayURL(req.URL, t.allowedHostSuffixes); err != nil {
		return nil, fmt.Errorf("target rejected: %w", err)
	}
	return t.base.RoundTrip(req)
}

func validateGatewayURL(target *url.URL, allowedHostSuffixes []string) error {
	if err := ValidatePublicURL(target); err != nil {
		return err
	}
	return validateAllowedHost(target.Hostname(), allowedHostSuffixes)
}

func validateAllowedHost(host string, suffixes []string) error {
	if len(suffixes) == 0 {
		return nil
	}
	host = strings.ToLower(strings.TrimSuffix(host, "."))
	for _, suffix := range suffixes {
		suffix = strings.ToLower(strings.TrimPrefix(strings.TrimSuffix(suffix, "."), "."))
		if suffix != "" && (host == suffix || strings.HasSuffix(host, "."+suffix)) {
			return nil
		}
	}
	return fmt.Errorf("target host is not allowed")
}

// ValidatePublicURL validates URL properties that do not require DNS. DNS
// results are checked and pinned by the gateway transport immediately before dialing.
func ValidatePublicURL(target *url.URL) error {
	if target == nil {
		return fmt.Errorf("URL is nil")
	}
	if target.Scheme != "http" && target.Scheme != "https" {
		return fmt.Errorf("unsupported URL scheme %q", target.Scheme)
	}
	if target.User != nil {
		return fmt.Errorf("URL credentials are not allowed")
	}
	if target.Fragment != "" {
		return fmt.Errorf("URL fragments are not allowed")
	}
	host := target.Hostname()
	if host == "" {
		return fmt.Errorf("URL host is empty")
	}
	if strings.Contains(host, "%") {
		return fmt.Errorf("IPv6 zone identifiers are not allowed")
	}
	if ip, err := netip.ParseAddr(strings.Trim(host, "[]")); err == nil && !isPublicIP(ip) {
		return fmt.Errorf("target IP is not public")
	}
	return nil
}

func resolvePublicAddresses(ctx context.Context, resolver Resolver, host string) ([]netip.Addr, error) {
	if ip, err := netip.ParseAddr(strings.Trim(host, "[]")); err == nil {
		if !isPublicIP(ip) {
			return nil, fmt.Errorf("target IP is not public")
		}
		return []netip.Addr{ip.Unmap()}, nil
	}

	resolved, err := resolver.LookupIPAddr(ctx, host)
	if err != nil {
		return nil, fmt.Errorf("resolve target host: %w", err)
	}
	public := make([]netip.Addr, 0, len(resolved))
	for _, item := range resolved {
		ip, ok := netip.AddrFromSlice(item.IP)
		if !ok {
			continue
		}
		ip = ip.Unmap()
		if !isPublicIP(ip) {
			return nil, fmt.Errorf("target host resolves to non-public IP %s", ip)
		}
		public = append(public, ip)
	}
	if len(public) == 0 {
		return nil, fmt.Errorf("target host has no public IP addresses")
	}
	return public, nil
}

var specialUsePrefixes = []netip.Prefix{
	netip.MustParsePrefix("0.0.0.0/8"),
	netip.MustParsePrefix("100.64.0.0/10"),
	netip.MustParsePrefix("192.0.0.0/24"),
	netip.MustParsePrefix("192.0.2.0/24"),
	netip.MustParsePrefix("198.18.0.0/15"),
	netip.MustParsePrefix("198.51.100.0/24"),
	netip.MustParsePrefix("203.0.113.0/24"),
	netip.MustParsePrefix("240.0.0.0/4"),
	netip.MustParsePrefix("64:ff9b::/96"),
	netip.MustParsePrefix("100::/64"),
	netip.MustParsePrefix("2001::/23"),
	netip.MustParsePrefix("2001:db8::/32"),
	netip.MustParsePrefix("2002::/16"),
	netip.MustParsePrefix("5f00::/16"),
}

func isPublicIP(ip netip.Addr) bool {
	ip = ip.Unmap()
	if !ip.IsValid() || !ip.IsGlobalUnicast() || ip.IsPrivate() || ip.IsLoopback() || ip.IsLinkLocalUnicast() {
		return false
	}
	for _, prefix := range specialUsePrefixes {
		if prefix.Contains(ip) {
			return false
		}
	}
	return true
}
