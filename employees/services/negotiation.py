"""Custom content negotiation classes for DRF."""

from django.http import Http404
from rest_framework.exceptions import NotAcceptable
from rest_framework.negotiation import DefaultContentNegotiation


class FlexibleContentNegotiation(DefaultContentNegotiation):
    """
    Prevents DRF from raising 404 when query params like ?format=csv or ?format=xlsx
    are passed to custom file export endpoints that return raw HttpResponse objects.
    """

    def select_renderer(self, request, renderers, format_suffix=None):
        try:
            return super().select_renderer(request, renderers, format_suffix)
        except (Http404, NotAcceptable, Exception):
            # Fall back to first renderer so the view action can handle custom file exports
            return (renderers[0], renderers[0].media_type)
